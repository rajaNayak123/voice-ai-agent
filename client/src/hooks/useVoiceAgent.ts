/**
 * useVoiceAgent — the central orchestration hook that wires together:
 *   - VoiceWebSocketClient (server connection + protocol messages)
 *   - MicCaptureService (mic -> PCM16 frames -> WS)
 *   - TtsPlaybackService (WS audio events -> speaker)
 *   - useConversationStore (all UI-facing state)
 *
 * It exposes a small imperative API (`startSession`, `endSession`,
 * `bargeIn`) and keeps all the WebSocket/audio plumbing out of components.
 * All cancellation goes through AbortController-backed services so a
 * barge-in or unmount can't leave a dangling mic stream, socket, or
 * audio source playing.
 */
import { useCallback, useEffect, useRef } from "react";
import { VoiceWebSocketClient } from "../services/transport/voiceWebSocketClient";
import { MicCaptureService } from "../services/audio/micCapture";
import { TtsPlaybackService } from "../services/tts/ttsPlaybackService";
import { BrowserTtsService } from "../services/tts/browserTtsService";
import { AmplitudeGate } from "../utils/amplitudeGate";
import { generateId } from "../utils/id";
import { useConversationStore } from "../store/conversationStore";
import type { ServerMessage } from "../types";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws/voice";

export function useVoiceAgent() {
  const wsRef = useRef<VoiceWebSocketClient | null>(null);
  const micRef = useRef<MicCaptureService | null>(null);
  const ttsRef = useRef<TtsPlaybackService | null>(null);
  const browserTtsRef = useRef<BrowserTtsService | null>(null);
  const ampGateRef = useRef(new AmplitudeGate());
  const isSessionActiveRef = useRef(false);
  const turnStartRef = useRef<number>(0);
  const localTurnStartRef = useRef<number>(0);

  const store = useConversationStore();

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    const s = useConversationStore.getState();

    switch (msg.type) {
      case "session.ready":
        break;

      case "state":
        s.setAgentState(msg.state);
        if (msg.state === "listening") {
          s.setPartialTranscript("");
        }
        break;

      case "stt.partial":
        if (localTurnStartRef.current === 0) {
          localTurnStartRef.current = Date.now();
        }
        s.setPartialTranscript(msg.text);
        break;

      case "stt.final": {
        if (localTurnStartRef.current === 0) {
          localTurnStartRef.current = Date.now() - msg.tElapsedMs;
        }
        s.setPartialTranscript("");
        s.setCurrentLanguage(msg.language);
        s.addTurn({
          id: generateId(),
          role: "user",
          content: msg.text,
          timestamp: Date.now(),
          language: msg.language,
        });
        s.resetStreamingResponse();
        s.resetMetrics();
        s.setMetrics({ sttFinalMs: msg.tElapsedMs });
        ttsRef.current?.startNewTurn();
        browserTtsRef.current?.reset();
        break;
      }

      case "rag.retrieved":
        s.setRetrievedChunks(msg.chunks);
        s.setMetrics({ ...s.metrics, ragRetrievalMs: msg.tElapsedMs });
        break;

      case "llm.token":
        s.appendStreamingToken(msg.token);
        if (s.metrics.llmFirstTokenMs === undefined) {
          s.setMetrics({ ...s.metrics, llmFirstTokenMs: msg.tElapsedMs });
        }
        break;

      case "llm.done": {
        s.setMetrics({ ...s.metrics, llmTotalMs: msg.tElapsedMs });
        s.addTurn({
          id: generateId(),
          role: "assistant",
          content: msg.fullText,
          timestamp: Date.now(),
          language: s.currentLanguage ?? undefined,
        });
        s.resetStreamingResponse();
        break;
      }

      case "tts.audio":
        if (s.metrics.ttsFirstAudioMs === undefined) {
          s.setMetrics({ ...s.metrics, ttsFirstAudioMs: msg.tElapsedMs });
        }
        void ttsRef.current?.playSentenceAudio(msg.audioBase64, msg.sentenceIndex);
        break;

      case "tts.local":
        if (s.metrics.ttsFirstAudioMs === undefined) {
          s.setMetrics({ ...s.metrics, ttsFirstAudioMs: msg.tElapsedMs });
        }
        if (msg.language === "hi" || msg.language === "hinglish") {
          browserTtsRef.current?.enqueue(msg.text, msg.language, msg.sentenceIndex);
        }
        break;

      case "metrics":
        s.setMetrics(msg.metrics);
        break;

      case "error":
        s.setError(msg.message);
        break;

      case "aborted":
        ttsRef.current?.interrupt();
        browserTtsRef.current?.stopImmediately();
        break;

      default:
        break;
    }
  }, []);

  /** Begin a session: connect WS, start mic capture, stream frames. */
  const startSession = useCallback(async () => {
    if (isSessionActiveRef.current) return;
    isSessionActiveRef.current = true;

    store.setError(null);
    ttsRef.current = new TtsPlaybackService();
    ttsRef.current.setCallbacks({
      onFirstAudio: () => {
        const elapsed = localTurnStartRef.current > 0 ? Date.now() - localTurnStartRef.current : 0;
        const s = useConversationStore.getState();
        s.setMetrics({ ...s.metrics, clientAudioStartMs: elapsed });
      },
    });
    browserTtsRef.current = new BrowserTtsService({
      onFirstAudio: () => {
        const elapsed = localTurnStartRef.current > 0 ? Date.now() - localTurnStartRef.current : 0;
        const s = useConversationStore.getState();
        s.setMetrics({ ...s.metrics, clientAudioStartMs: elapsed });
      },
    });

    const ws = new VoiceWebSocketClient(WS_URL, {
      onMessage: handleServerMessage,
      onStatusChange: (status) => useConversationStore.getState().setConnectionStatus(status),
    });
    wsRef.current = ws;
    ws.connect();

    const mic = new MicCaptureService();
    micRef.current = mic;

    await mic.start({
      onAudioFrame: (frame) => {
        wsRef.current?.sendAudio(frame);

        // Local fast-path barge-in detection: if the agent is speaking
        // and we detect speech-like energy in the mic input, stop local
        // playback immediately (don't wait for the server round-trip)
        // and tell the server too.
        const state = useConversationStore.getState().agentState;
        if (state === "speaking" || state === "thinking") {
          const int16 = new Int16Array(frame);
          if (ampGateRef.current.feed(int16)) {
            triggerBargeIn();
          }
        }
      },
      onError: (err) => {
        store.setError(`Microphone error: ${err.message}`);
      },
    });

    turnStartRef.current = Date.now();
    localTurnStartRef.current = 0;
    ws.sendMessage({ type: "audio.start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleServerMessage]);

  const triggerBargeIn = useCallback(() => {
    ttsRef.current?.interrupt();
    browserTtsRef.current?.stopImmediately();
    localTurnStartRef.current = 0;
    wsRef.current?.sendMessage({ type: "barge_in" });
  }, []);

  const endSession = useCallback(() => {
    isSessionActiveRef.current = false;
    wsRef.current?.sendMessage({ type: "session.end" });
    wsRef.current?.close();
    micRef.current?.stop();
    ttsRef.current?.destroy();
    browserTtsRef.current?.stopImmediately();
    wsRef.current = null;
    micRef.current = null;
    ttsRef.current = null;
    browserTtsRef.current = null;
    localTurnStartRef.current = 0;
    useConversationStore.getState().setAgentState("idle");
    useConversationStore.getState().setPartialTranscript("");
  }, []);

  useEffect(() => {
    return () => {
      endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    startSession,
    endSession,
    bargeIn: triggerBargeIn,
    connectionStatus: store.connectionStatus,
    agentState: store.agentState,
  };
}
