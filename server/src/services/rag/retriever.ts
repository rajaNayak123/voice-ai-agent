
import { embedQuery } from "./embeddings.js";
import { searchSimilar } from "./qdrantClient.js";
import { env } from "../../utils/env.js";
import { childLogger } from "../../utils/logger.js";
import type { RetrievedChunk } from "../../types/index.js";

const log = childLogger("retriever");

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  grounded: boolean;
  tookMs: number;
}

export async function retrieveRelevantChunks(query: string): Promise<RetrievalResult> {
  const start = Date.now();

  const vector = await embedQuery(query);
  const results = await searchSimilar(vector, env.RAG_TOP_K);

  const aboveThreshold = results.filter((r) => r.score >= env.RAG_SCORE_THRESHOLD);

  const chunks: RetrievedChunk[] = aboveThreshold.map((r) => ({
    id: r.id,
    text: r.payload.text,
    score: r.score,
    source: r.payload.source,
  }));

  const tookMs = Date.now() - start;
  log.info(
    {
      query,
      totalCandidates: results.length,
      aboveThreshold: aboveThreshold.length,
      threshold: env.RAG_SCORE_THRESHOLD,
      tookMs,
      topScore: results[0]?.score,
    },
    "retrieval complete"
  );

  return {
    chunks,
    grounded: chunks.length > 0,
    tookMs,
  };
}
