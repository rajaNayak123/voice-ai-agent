
import { pipeline } from "@xenova/transformers";
import { withRetry } from "../../utils/retry.js";
import { childLogger } from "../../utils/logger.js";

const log = childLogger("embeddings");

let extractor: any = null;

async function getExtractor() {
  if (!extractor) {

    extractor = await pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2");
  }
  return extractor;
}

export async function embedQuery(text: string): Promise<number[]> {
  return withRetry(async () => {
    const ext = await getExtractor();
    const result = await ext(text, { pooling: "mean", normalize: true });
    return Array.from(result.data);
  }, {
    label: "embedQuery",
    retries: 2,
    shouldRetry: (err) => {
      log.warn({ err }, "embedQuery failed, will retry if attempts remain");
      return true;
    },
  });
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  return withRetry(async () => {
    const ext = await getExtractor();
    const results: number[][] = [];
    for (const text of texts) {
      const result = await ext(text, { pooling: "mean", normalize: true });
      results.push(Array.from(result.data));
    }
    return results;
  }, {
    label: "embedDocuments",
    retries: 2,
  });
}
