/**
 * The actual RAG pipeline (embeddings, Qdrant search, grounding) runs
 * entirely on the server — see server/src/services/rag/*. The client
 * only ever sees the already-retrieved, already-scored chunks via the
 * `rag.retrieved` WebSocket event, which it displays for transparency
 * (so the user/developer can see what grounded the agent's answer).
 * This module just re-exports the shape for use in UI components.
 */
export type { RetrievedChunk } from "../../types";
