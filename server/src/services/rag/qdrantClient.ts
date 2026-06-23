
import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../../utils/env.js";
import { withRetry } from "../../utils/retry.js";
import { childLogger } from "../../utils/logger.js";

const log = childLogger("qdrant");

let _client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!_client) {
    _client = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY || undefined,
    });
  }
  return _client;
}

export async function ensureCollection(vectorSize = 384): Promise<void> {
  const client = getQdrantClient();
  const { collections } = await client.getCollections();
  const exists = collections.some((c) => c.name === env.QDRANT_COLLECTION);

  if (!exists) {
    log.info({ collection: env.QDRANT_COLLECTION, vectorSize }, "creating Qdrant collection");
    await client.createCollection(env.QDRANT_COLLECTION, {
      vectors: { size: vectorSize, distance: "Cosine" },
    });
  } else {
    log.info({ collection: env.QDRANT_COLLECTION }, "Qdrant collection already exists");
  }
}

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload: { text: string; source: string; chunkIndex: number };
}

export async function upsertPoints(points: QdrantPoint[]): Promise<void> {
  const client = getQdrantClient();
  await withRetry(
    () =>
      client.upsert(env.QDRANT_COLLECTION, {
        wait: true,
        points,
      }),
    { label: "qdrant.upsert", retries: 3 }
  );
}

export interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload: { text: string; source: string; chunkIndex: number };
}

export async function searchSimilar(
  vector: number[],
  topK: number
): Promise<QdrantSearchResult[]> {
  const client = getQdrantClient();
  const results = await withRetry(
    () =>
      client.search(env.QDRANT_COLLECTION, {
        vector,
        limit: topK,
        with_payload: true,
      }),
    { label: "qdrant.search", retries: 2 }
  );

  return results.map((r) => ({
    id: r.id,
    score: r.score,
    payload: r.payload as QdrantSearchResult["payload"],
  }));
}

export async function collectionStats(): Promise<{ pointsCount: number }> {
  const client = getQdrantClient();
  const info = await client.getCollection(env.QDRANT_COLLECTION);
  return { pointsCount: info.points_count ?? 0 };
}
