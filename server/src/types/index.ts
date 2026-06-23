/**
 * Shared type definitions used across the server: WebSocket protocol
 * messages, RAG results, conversation turns, and pipeline metrics.
 *
 * The WebSocket protocol is a simple discriminated union of JSON
 * messages (`ClientMessage` / `ServerMessage`) plus raw binary audio
 * frames sent by the client for STT ingestion.
 */

export type SupportedLanguage = "en" | "hi" | "hinglish";

export interface TranscriptChunk {
  text: string;
  isFinal: boolean;
  /** Deepgram's detected language code for this utterance, if available. */
  detectedLanguage?: string;
  confidence?: number;
}

export interface RetrievedChunk {
  id: string | number;
  text: string;
  score: number;
  source: string;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  language?: SupportedLanguage;
}

export interface PipelineMetrics {
  sttFirstPartialMs?: number;
  sttFinalMs?: number;
  ragRetrievalMs?: number;
  llmFirstTokenMs?: number;
  llmTotalMs?: number;
  ttsFirstAudioMs?: number;
  clientAudioStartMs?: number;
  totalLatencyMs?: number;
}

// --------------------------------------------------------------------------
// Client -> Server messages (control channel, JSON, sent over the WS text
// frames interleaved with binary audio frames)
// --------------------------------------------------------------------------

export type ClientMessage =
  | { type: "session.start"; sessionId: string }
  | { type: "audio.start" }
  | { type: "audio.stop" }
  | { type: "barge_in" }
  | { type: "session.end" };

// --------------------------------------------------------------------------
// Server -> Client messages
// --------------------------------------------------------------------------

export type ServerMessage =
  | { type: "session.ready"; sessionId: string }
  | { type: "stt.partial"; text: string; tElapsedMs: number }
  | { type: "stt.final"; text: string; language: SupportedLanguage; tElapsedMs: number }
  | { type: "rag.retrieved"; chunks: RetrievedChunk[]; tElapsedMs: number }
  | { type: "llm.token"; token: string; tElapsedMs: number }
  | { type: "llm.sentence"; sentence: string; index: number }
  | { type: "llm.done"; fullText: string; tElapsedMs: number }
  | { type: "tts.audio"; audioBase64: string; mimeType: string; sentenceIndex: number; tElapsedMs: number }
  | { type: "tts.local"; text: string; language: SupportedLanguage; sentenceIndex: number; tElapsedMs: number }
  | { type: "tts.done"; sentenceIndex: number }
  | { type: "state"; state: AgentState }
  | { type: "metrics"; metrics: PipelineMetrics }
  | { type: "error"; message: string; code?: string }
  | { type: "aborted"; reason: string };

export type AgentState = "idle" | "listening" | "thinking" | "speaking";

export interface IngestSourceFile {
  filename: string;
  content: string;
}
