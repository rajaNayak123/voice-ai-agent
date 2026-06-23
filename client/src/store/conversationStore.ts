
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

  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  agentState: AgentState;
  setAgentState: (state: AgentState) => void;

  partialTranscript: string;
  setPartialTranscript: (text: string) => void;

  streamingResponse: string;
  appendStreamingToken: (token: string) => void;
  resetStreamingResponse: () => void;

  retrievedChunks: RetrievedChunk[];
  setRetrievedChunks: (chunks: RetrievedChunk[]) => void;

  history: ConversationTurn[];
  addTurn: (turn: ConversationTurn) => void;
  clearHistory: () => void;

  currentLanguage: SupportedLanguage | null;
  setCurrentLanguage: (lang: SupportedLanguage) => void;

  metrics: PipelineMetrics;
  setMetrics: (metrics: PipelineMetrics) => void;
  resetMetrics: () => void;

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
