/**
 * Centralized, validated environment configuration.
 *
 * All env access in the codebase should go through this module instead of
 * reading `process.env` directly, so that missing/invalid configuration
 * fails fast at boot with a clear error rather than causing a confusing
 * runtime failure deep inside a streaming pipeline.
 */
import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.string().default("info"),

  DEEPGRAM_API_KEY: z.string().min(1, "DEEPGRAM_API_KEY is required"),
  DEEPGRAM_STT_MODEL: z.string().default("nova-2"),
  DEEPGRAM_STT_LANGUAGE: z.string().default("multi"),
  DEEPGRAM_TTS_MODEL: z.string().default("aura-asteria-en"),

  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
  GROQ_MODEL: z.string().default("llama-3.1-8b-instant"),
  GROQ_TEMPERATURE: z.coerce.number().default(0.3),
  GROQ_MAX_TOKENS: z.coerce.number().default(400),

  HUGGINGFACE_API_KEY: z.string().optional().default(""),
  HF_EMBEDDING_MODEL: z
    .string()
    .default("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"),

  QDRANT_URL: z.string().default("http://localhost:6333"),
  QDRANT_API_KEY: z.string().optional().default(""),
  QDRANT_COLLECTION: z.string().default("novadesk_kb"),

  RAG_TOP_K: z.coerce.number().default(4),
  RAG_SCORE_THRESHOLD: z.coerce.number().default(0.45),
  RAG_CHUNK_SIZE: z.coerce.number().default(500),
  RAG_CHUNK_OVERLAP: z.coerce.number().default(80),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("\n❌ Invalid environment configuration:\n");
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    // eslint-disable-next-line no-console
    console.error("\nCopy server/.env.example to server/.env and fill in the values.\n");
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
