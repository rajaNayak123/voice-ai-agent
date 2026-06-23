/**
 * Thin wrapper around LangChain's HuggingFaceInferenceEmbeddings.
 *
 * We use a multilingual sentence-transformer model
 * (paraphrase-multilingual-MiniLM-L12-v2) so that English, Hindi, and
 * Hinglish queries all land in a shared embedding space close to their
 * corresponding (English-authored) knowledge base chunks. This is what
 * lets a Hindi/Hinglish question like "NovaDesk ki pricing kya hai?"
 * retrieve the same pricing.txt chunk as the English equivalent.
 */
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { env } from "../../utils/env.js";
import { withRetry } from "../../utils/retry.js";
import { childLogger } from "../../utils/logger.js";

const log = childLogger("embeddings");

let _embeddings: HuggingFaceInferenceEmbeddings | null = null;

export function getEmbeddings(): HuggingFaceInferenceEmbeddings {
  if (!_embeddings) {
    _embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: env.HUGGINGFACE_API_KEY,
      model: env.HF_EMBEDDING_MODEL,
    });
  }
  return _embeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  const embeddings = getEmbeddings();
  return withRetry(() => embeddings.embedQuery(text), {
    label: "embedQuery",
    retries: 2,
    shouldRetry: (err) => {
      log.warn({ err }, "embedQuery failed, will retry if attempts remain");
      return true;
    },
  });
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const embeddings = getEmbeddings();
  return withRetry(() => embeddings.embedDocuments(texts), {
    label: "embedDocuments",
    retries: 2,
  });
}
