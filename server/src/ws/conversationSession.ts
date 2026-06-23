
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { DeepgramSTTSession } from "../services/stt/deepgramStt.js";
import { retrieveRelevantChunks } from "../services/rag/retriever.js";
import { streamChatCompletion } from "../services/llm/groqClient.js";
import { buildMessages, buildSystemPrompt, NOT_FOUND_RESPONSES, type ChatMessage } from "../services/llm/prompt.js";
import { synthesizeSpeechStream } from "../services/tts/deepgramTts.js";
import { SentenceDetector } from "../utils/sentenceDetector.js";
import { detectLanguage } from "../services/language/detectLanguage.js";
import { childLogger } from "../utils/logger.js";
import type {
  AgentState,
  ClientMessage,
  ConversationTurn,
  PipelineMetrics,
  ServerMessage,
  SupportedLanguage,
} from "../types/index.js";

const log = childLogger("session");

export class ConversationSession {
  readonly id = randomUUID();
  private state: AgentState = "idle";
  private stt: DeepgramSTTSession | null = null;
  private history: ConversationTurn[] = [];
  private chatHistory: ChatMessage[] = [];

  private turnAbortController: AbortController | null = null;
  private currentTurnId = 0;

  constructor(private readonly ws: WebSocket) {}

  start(): void {
    this.send({ type: "session.ready", sessionId: this.id });
    this.initStt();
    this.setState("idle");
  }

  handleClientMessage(msg: ClientMessage): void {
    switch (msg.type) {
      case "session.start":

        break;
      case "audio.start":
        this.setState("listening");
        break;
      case "audio.stop":

        break;
      case "barge_in":
        this.handleBargeIn();
        break;
      case "session.end":
        this.teardown();
        break;
    }
  }

  handleAudioFrame(frame: Buffer): void {
    this.stt?.sendAudio(frame);
  }

  private turnStartedAt = 0;

  private initStt(): void {
    this.stt = new DeepgramSTTSession({
      onPartial: (chunk) => {
        if (this.turnStartedAt === 0) this.turnStartedAt = Date.now();
        if (this.state === "speaking" || this.state === "thinking") {
          this.handleBargeIn();
        }
        this.setState("listening");
        this.send({
          type: "stt.partial",
          text: chunk.text,
          tElapsedMs: this.elapsed(),
        });
      },
      onFinal: (chunk) => {
        const text = chunk.text.trim();
        if (!text) return;
        const language = detectLanguage(text, chunk.detectedLanguage);
        this.send({ type: "stt.final", text, language, tElapsedMs: this.elapsed() });
        void this.handleUserUtterance(text, language);
      },
      onError: (err) => {
        log.error({ err, sessionId: this.id }, "STT error");
        this.send({ type: "error", message: "Speech recognition error. Please try again.", code: "STT_ERROR" });
      },
      onClose: () => {
        log.info({ sessionId: this.id }, "STT session closed");
      },
    });
    this.stt.connect();
  }

  private async handleUserUtterance(text: string, language: SupportedLanguage): Promise<void> {
    const turnId = ++this.currentTurnId;
    this.turnAbortController?.abort();
    const controller = new AbortController();
    this.turnAbortController = controller;

    this.history.push({ role: "user", content: text, timestamp: Date.now(), language });
    this.chatHistory.push({ role: "user", content: text });

    this.setState("thinking");
    const metrics: PipelineMetrics = {
      sttFinalMs: this.elapsed(),
    };

    try {

      const ragStart = Date.now();
      const { chunks, grounded } = await retrieveRelevantChunks(text);
      metrics.ragRetrievalMs = Date.now() - ragStart;
      if (this.isStale(turnId, controller)) return;

      this.send({
        type: "rag.retrieved",
        chunks: chunks.map((c) => ({ ...c, text: c.text.slice(0, 160) })),
        tElapsedMs: this.elapsed(),
      });

      const systemPrompt = buildSystemPrompt(chunks);
      const messages = buildMessages(systemPrompt, this.chatHistory.slice(0, -1), text);

      if (!grounded) {
        const reply = NOT_FOUND_RESPONSES[language];
        await this.speakReply(reply, language, turnId, controller, metrics,  false);
        return;
      }

      await this.streamLlmAndSpeak(messages, language, turnId, controller, metrics);
    } catch (err) {
      if (controller.signal.aborted) {
        log.info({ sessionId: this.id, turnId }, "turn aborted (barge-in or stale)");
        return;
      }
      log.error({ err, sessionId: this.id }, "error processing user utterance");
      this.send({ type: "error", message: "Something went wrong generating a response.", code: "PIPELINE_ERROR" });
      this.setState("idle");
    }
  }

  private async streamLlmAndSpeak(
    messages: ChatMessage[],
    language: SupportedLanguage,
    turnId: number,
    controller: AbortController,
    metrics: PipelineMetrics
  ): Promise<void> {
    const llmStart = Date.now();
    const detector = new SentenceDetector();
    let fullText = "";
    let sentenceIndex = 0;
    let firstTokenSeen = false;
    const ttsQueue: Promise<void>[] = [];

    for await (const token of streamChatCompletion({ messages, signal: controller.signal })) {
      if (this.isStale(turnId, controller)) return;

      if (!firstTokenSeen) {
        firstTokenSeen = true;
        metrics.llmFirstTokenMs = Date.now() - llmStart;
      }

      fullText += token;
      this.send({ type: "llm.token", token, tElapsedMs: this.elapsed() });

      const sentences = detector.push(token);
      for (const sentence of sentences) {
        const idx = sentenceIndex++;
        this.send({ type: "llm.sentence", sentence, index: idx });
        ttsQueue.push(this.speakSentence(sentence, language, idx, turnId, controller, metrics));
      }
    }

    if (this.isStale(turnId, controller)) return;

    const trailing = detector.flush();
    for (const sentence of trailing) {
      const idx = sentenceIndex++;
      this.send({ type: "llm.sentence", sentence, index: idx });
      ttsQueue.push(this.speakSentence(sentence, language, idx, turnId, controller, metrics));
    }

    metrics.llmTotalMs = Date.now() - llmStart;
    this.send({ type: "llm.done", fullText, tElapsedMs: this.elapsed() });
    this.history.push({ role: "assistant", content: fullText, timestamp: Date.now(), language });
    this.chatHistory.push({ role: "assistant", content: fullText });

    await Promise.allSettled(ttsQueue);
    if (this.isStale(turnId, controller)) return;

    metrics.totalLatencyMs = this.elapsed();
    this.send({ type: "metrics", metrics });
    this.setState("idle");
  }

  private async speakReply(
    text: string,
    language: SupportedLanguage,
    turnId: number,
    controller: AbortController,
    metrics: PipelineMetrics,
    _fromLlm: boolean
  ): Promise<void> {
    this.send({ type: "llm.sentence", sentence: text, index: 0 });
    this.send({ type: "llm.done", fullText: text, tElapsedMs: this.elapsed() });
    this.history.push({ role: "assistant", content: text, timestamp: Date.now(), language });
    this.chatHistory.push({ role: "assistant", content: text });

    await this.speakSentence(text, language, 0, turnId, controller, metrics);
    if (this.isStale(turnId, controller)) return;

    metrics.totalLatencyMs = this.elapsed();
    this.send({ type: "metrics", metrics });
    this.setState("idle");
  }

  private async speakSentence(
    sentence: string,
    language: SupportedLanguage,
    index: number,
    turnId: number,
    controller: AbortController,
    metrics: PipelineMetrics
  ): Promise<void> {
    if (this.isStale(turnId, controller)) return;
    this.setState("speaking");

    if (language === "hi" || language === "hinglish") {
      this.send({
        type: "tts.local",
        text: sentence,
        language,
        sentenceIndex: index,
        tElapsedMs: this.elapsed(),
      });
      return;
    }

    const ttsStart = Date.now();

    try {

      const chunks: Buffer[] = [];
      let firstChunkAt: number | null = null;

      for await (const audioChunk of synthesizeSpeechStream({ text: sentence, language, signal: controller.signal })) {
        if (this.isStale(turnId, controller)) return;
        if (firstChunkAt === null) {
          firstChunkAt = Date.now();
          if (metrics.ttsFirstAudioMs === undefined) {
            metrics.ttsFirstAudioMs = firstChunkAt - ttsStart;
          }
        }
        chunks.push(audioChunk);
      }

      if (this.isStale(turnId, controller)) return;
      if (chunks.length === 0) return;

      const fullAudio = Buffer.concat(chunks);
      this.send({
        type: "tts.audio",
        audioBase64: fullAudio.toString("base64"),
        mimeType: "audio/wav",
        sentenceIndex: index,
        tElapsedMs: this.elapsed(),
      });
      if (!this.isStale(turnId, controller)) {
        this.send({ type: "tts.done", sentenceIndex: index });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      log.error({ err }, "TTS synthesis error");
      this.send({ type: "error", message: "Voice synthesis error.", code: "TTS_ERROR" });
    }
  }

  private handleBargeIn(): void {
    if (this.state !== "speaking" && this.state !== "thinking") return;
    log.info({ sessionId: this.id }, "barge-in detected: aborting current turn");
    this.turnAbortController?.abort();
    this.send({ type: "aborted", reason: "barge_in" });
    this.setState("listening");
    this.turnStartedAt = Date.now();
  }

  private isStale(turnId: number, controller: AbortController): boolean {
    return controller.signal.aborted || turnId !== this.currentTurnId;
  }

  private elapsed(): number {
    return this.turnStartedAt === 0 ? 0 : Date.now() - this.turnStartedAt;
  }

  private setState(state: AgentState): void {
    this.state = state;
    this.send({ type: "state", state });
  }

  private send(msg: ServerMessage): void {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  teardown(): void {
    this.turnAbortController?.abort();
    this.stt?.close();
  }
}
