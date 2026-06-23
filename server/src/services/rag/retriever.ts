
import { embedQuery } from "./embeddings.js";
import { searchSimilar } from "./qdrantClient.js";
import { env } from "../../utils/env.js";
import { childLogger } from "../../utils/logger.js";
import { getChatCompletion } from "../llm/groqClient.js";
import type { RetrievedChunk } from "../../types/index.js";

const log = childLogger("retriever");

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  grounded: boolean;
  tookMs: number;
}

export async function retrieveRelevantChunks(query: string): Promise<RetrievalResult> {
  const start = Date.now();

  let queries = [query];
  try {
    const rawResponse = await getChatCompletion({
      messages: [
        {
          role: "system",
          content: "You are an assistant that generates alternative search queries for a customer support knowledge base of NovaDesk (a customer support SaaS company). " +
                   "NovaDesk offers Starter, Growth, Scale, and Enterprise plans, and features like NovaDesk Inbox (shared inbox), NovaDesk Bot (AI chatbot), and NovaDesk Voice (AI voice support add-on). " +
                   "Generate exactly 3 alternative search queries in the same language/script style as the user's query (English, Hindi Devanagari, or Hinglish) that would help retrieve the right information from the SaaS knowledge base. " +
                   "Generate each query on a new line. Do not number them. Do not explain them. Do not output anything else."
        },
        {
          role: "user",
          content: `Query: ${query}`
        }
      ]
    });

    const alternatives = rawResponse
      .split("\n")
      .map((q) => q.trim().replace(/^[-*0-9.\s]+/, "")) // Clean list markers or numbers
      .filter((q) => q.length > 0)
      .slice(0, 3);

    queries = [query, ...alternatives];
    log.info({ original: query, alternatives }, "generated alternative queries");
  } catch (err) {
    log.warn({ err }, "failed to generate query variations, falling back to original query");
  }

  // Retrieve matching chunks for all query variations in parallel
  const retrievalPromises = queries.map(async (q) => {
    try {
      const vector = await embedQuery(q);
      const results = await searchSimilar(vector, env.RAG_TOP_K);
      return results;
    } catch (err) {
      log.error({ query: q, err }, "retrieval failed for query variation");
      return [];
    }
  });

  const allResults = await Promise.all(retrievalPromises);

  // Combine and deduplicate chunks by their ID, keeping the highest score
  const uniqueChunksMap = new Map<string | number, RetrievedChunk>();

  for (const queryResults of allResults) {
    for (const r of queryResults) {
      if (r.score >= env.RAG_SCORE_THRESHOLD) {
        const existing = uniqueChunksMap.get(r.id);
        if (!existing || r.score > existing.score) {
          uniqueChunksMap.set(r.id, {
            id: r.id,
            text: r.payload.text,
            score: r.score,
            source: r.payload.source,
          });
        }
      }
    }
  }

  // Sort final chunks by score in descending order and slice to TOP_K
  const chunks = Array.from(uniqueChunksMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, env.RAG_TOP_K);

  const tookMs = Date.now() - start;
  log.info(
    {
      query,
      queriesUsedCount: queries.length,
      totalGroundedChunks: chunks.length,
      threshold: env.RAG_SCORE_THRESHOLD,
      tookMs,
      topScore: chunks[0]?.score,
    },
    "retrieval complete"
  );

  return {
    chunks,
    grounded: chunks.length > 0,
    tookMs,
  };
}

