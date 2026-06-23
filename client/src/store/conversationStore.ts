/**
 * Central Zustand store for conversation state: agent state machine,
 * live transcript, streaming response text, conversation history,
 * current language, connection status, and latency metrics.
 *
 * Kept intentionally "dumb" — this store just holds state and exposes
 * setters. All the orchestration logic (WebSocket lifecycle, audio
 * capture/playback, barge-in detection) lives in hooks/services and
 * calls into this store, which keeps the store easy to reason about and
 * the side-effectful code easy to test/replace independently.
 */
import { create } from "zustand";
import type {
  AgentState,
  ConnectionStatus,
  ConversationTurn,
  PipelineMetrics,
  RetrievedChunk,
  SupportedLanguage,
} from "../types";

interface ConversationState {
  // Connection
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Agent state machine
  agentState: AgentState;
  setAgentState: (state: AgentState) => void;

  // Live STT
  partialTranscript: string;
  setPartialTranscript: (text: string) => void;

  // Streaming LLM response (current turn, in progress)
  streamingResponse: string;
  appendStreamingToken: (token: string) => void;
  resetStreamingResponse: () => void;

  // Retrieved RAG chunks for the current turn (for transparency/debug UI)
  retrievedChunks: RetrievedChunk[];
  setRetrievedChunks: (chunks: RetrievedChunk[]) => void;

  // Conversation history
  history: ConversationTurn[];
  addTurn: (turn: ConversationTurn) => void;
  clearHistory: () => void;

  // Language
  currentLanguage: SupportedLanguage | null;
  setCurrentLanguage: (lang: SupportedLanguage) => void;

  // Metrics
  metrics: PipelineMetrics;
  setMetrics: (metrics: PipelineMetrics) => void;
  resetMetrics: () => void;

  // Errors
  lastError: string | null;
  setError: (message: string | null) => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  connectionStatus: "disconnected",
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  agentState: "idle",
  setAgentState: (state) => set({ agentState: state }),

  partialTranscript: "",
  setPartialTranscript: (text) => set({ partialTranscript: text }),

  streamingResponse: "",
  appendStreamingToken: (token) =>
    set((s) => ({ streamingResponse: s.streamingResponse + token })),
  resetStreamingResponse: () => set({ streamingResponse: "" }),

  retrievedChunks: [],
  setRetrievedChunks: (chunks) => set({ retrievedChunks: chunks }),

  history: [],
  addTurn: (turn) => set((s) => ({ history: [...s.history, turn] })),
  clearHistory: () => set({ history: [] }),

  currentLanguage: null,
  setCurrentLanguage: (lang) => set({ currentLanguage: lang }),

  metrics: {},
  setMetrics: (metrics) => set({ metrics }),
  resetMetrics: () => set({ metrics: {} }),

  lastError: null,
  setError: (message) => set({ lastError: message }),
}));
