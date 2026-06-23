
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { chunkDocuments, type SourceDocument } from "./chunker.js";
import { embedDocuments } from "./embeddings.js";
import { ensureCollection, upsertPoints, type QdrantPoint } from "./qdrantClient.js";
import { childLogger } from "../../utils/logger.js";

const log = childLogger("ingest");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB_DIR = path.resolve(__dirname, "../../../knowledge-base");

async function loadKnowledgeBaseFiles(): Promise<SourceDocument[]> {
  const files = await fs.readdir(KB_DIR);
  const txtFiles = files.filter((f) => f.endsWith(".txt"));

  if (txtFiles.length === 0) {
    throw new Error(`No .txt files found in ${KB_DIR}`);
  }

  const docs: SourceDocument[] = [];
  for (const filename of txtFiles) {
    const content = await fs.readFile(path.join(KB_DIR, filename), "utf-8");
    docs.push({ source: filename, content });
  }
  return docs;
}

function deterministicId(source: string, chunkIndex: number): string {
  return crypto.createHash("md5").update(`${source}::${chunkIndex}`).digest("hex");
}

async function main() {
  log.info({ dir: KB_DIR }, "loading knowledge base files");
  const docs = await loadKnowledgeBaseFiles();
  log.info({ count: docs.length, files: docs.map((d) => d.source) }, "loaded files");

  const chunks = await chunkDocuments(docs);
  log.info({ totalChunks: chunks.length }, "chunked documents");

  log.info("embedding chunks (this calls the HuggingFace Inference API)...");
  const vectors = await embedDocuments(chunks.map((c) => c.text));

  const vectorSize = vectors[0]?.length;
  if (!vectorSize) {
    throw new Error("Embedding model returned no vectors — check HUGGINGFACE_API_KEY");
  }

  await ensureCollection(vectorSize);

  const points: QdrantPoint[] = chunks.map((chunk, i) => ({
    id: deterministicId(chunk.source, chunk.chunkIndex),
    vector: vectors[i],
    payload: { text: chunk.text, source: chunk.source, chunkIndex: chunk.chunkIndex },
  }));

  log.info({ count: points.length }, "upserting points into Qdrant");

  const BATCH_SIZE = 64;
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    await upsertPoints(batch);
    log.info({ upserted: Math.min(i + BATCH_SIZE, points.length), total: points.length }, "progress");
  }

  log.info("✅ Ingestion complete");
}

main().catch((err) => {
  log.error({ err }, "ingestion failed");
  process.exit(1);
});
