/**
 * Wraps a single Deepgram streaming STT connection for one user
 * utterance turn.
 *
 * Responsibilities:
 *  - Open a live transcription WebSocket to Deepgram with multilingual
 *    (`language=multi`) detection so English / Hindi / Hinglish speech
 *    all transcribe correctly without the client having to pre-select a
 *    language.
 *  - Forward binary audio frames from the browser straight through.
 *  - Emit partial (interim) and final transcript events with timing info
 *    so the UI can show live captions and we can record STT latency.
 *  - Auto-reconnect with backoff if the upstream socket drops mid-call
 *    (network blip), buffering only a small amount of audio so we don't
 *    lose the user's speech if a reconnect happens mid-sentence.
 */
import { createClient, LiveTranscriptionEvents, type LiveClient } from "@deepgram/sdk";
import { env } from "../../utils/env.js";
import { childLogger } from "../../utils/logger.js";
import type { TranscriptChunk } from "../../types/index.js";

const log = childLogger("stt");

export interface DeepgramSTTHandlers {
  onPartial: (chunk: TranscriptChunk) => void;
  onFinal: (chunk: TranscriptChunk) => void;
  onError: (err: Error) => void;
  onClose: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 4;

/**
 * The Deepgram SDK's `LiveClient.send` expects ArrayBuffer | SharedArrayBuffer
 * | Blob, not a Node Buffer. Node Buffers are Uint8Array views over an
 * ArrayBuffer that may be larger than the view itself (pooled allocations),
 * so we must slice to the exact byte range rather than passing `.buffer`
 * directly.
 */
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export class DeepgramSTTSession {
  private connection: LiveClient | null = null;
  private readonly client = createClient(env.DEEPGRAM_API_KEY);
  private reconnectAttempts = 0;
  private closedByUser = false;
  private audioBuffer: Buffer[] = [];
  private readonly MAX_BUFFERED_FRAMES = 50;

  constructor(private readonly handlers: DeepgramSTTHandlers) {}

  connect(): void {
    this.closedByUser = false;
    this.openConnection();
  }

  private openConnection(): void {
    log.info({ attempt: this.reconnectAttempts }, "opening Deepgram STT connection");

    const connection = this.client.listen.live({
      model: env.DEEPGRAM_STT_MODEL,
      language: env.DEEPGRAM_STT_LANGUAGE, // "multi" => code-switch detection
      smart_format: true,
      interim_results: true,
      punctuate: true,
      encoding: "linear16",
      sample_rate: 16000,
      channels: 1,
      endpointing: 600, // ms of silence before Deepgram finalizes an utterance
      utterance_end_ms: 1000,
      vad_events: true,
    });

    connection.on(LiveTranscriptionEvents.Open, () => {
      log.info("Deepgram STT connection open");
      this.reconnectAttempts = 0;
      // Flush any audio buffered during a reconnect gap.
      for (const frame of this.audioBuffer) {
        connection.send(toArrayBuffer(frame));
      }
      this.audioBuffer = [];
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const alt = data.channel?.alternatives?.[0];
      if (!alt || !alt.transcript) return;

      const chunk: TranscriptChunk = {
        text: alt.transcript,
        isFinal: Boolean(data.is_final),
        confidence: alt.confidence,
        detectedLanguage: data.language ?? undefined,
      };

      if (chunk.isFinal) {
        this.handlers.onFinal(chunk);
      } else {
        this.handlers.onPartial(chunk);
      }
    });

    connection.on(LiveTranscriptionEvents.Error, (err) => {
      log.error({ err }, "Deepgram STT error");
      this.handlers.onError(err instanceof Error ? err : new Error(String(err)));
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      log.info({ closedByUser: this.closedByUser }, "Deepgram STT connection closed");
      if (!this.closedByUser) {
        this.attemptReconnect();
      } else {
        this.handlers.onClose();
      }
    });

    this.connection = connection;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      log.error("max STT reconnect attempts reached, giving up");
      this.handlers.onError(new Error("STT connection lost and could not be reestablished"));
      this.handlers.onClose();
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(2000, 250 * 2 ** this.reconnectAttempts);
    log.warn({ attempt: this.reconnectAttempts, delay }, "reconnecting Deepgram STT");
    setTimeout(() => this.openConnection(), delay);
  }

  /** Send a raw PCM16 audio frame from the browser to Deepgram. */
  sendAudio(frame: Buffer): void {
    if (this.connection && this.connection.getReadyState() === 1 /* OPEN */) {
      this.connection.send(toArrayBuffer(frame));
    } else {
      // Buffer briefly while reconnecting so we don't drop the user's speech.
      if (this.audioBuffer.length < this.MAX_BUFFERED_FRAMES) {
        this.audioBuffer.push(frame);
      }
    }
  }

  /** Gracefully end this STT session (e.g. on barge-in or session end). */
  close(): void {
    this.closedByUser = true;
    this.connection?.requestClose();
  }
}
