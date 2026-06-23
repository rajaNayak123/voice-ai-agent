/**
 * Splits raw knowledge-base documents into overlapping chunks suitable
 * for embedding. We use LangChain's RecursiveCharacterTextSplitter, which
 * tries to split on paragraph/sentence boundaries first and only falls
 * back to hard character splits when a paragraph is too long — this
 * keeps each chunk semantically coherent (one chunk rarely straddles two
 * unrelated FAQ entries, for example).
 */
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { env } from "../../utils/env.js";

export interface SourceDocument {
  source: string; // filename, e.g. "pricing.txt"
  content: string;
}

export interface DocumentChunk {
  source: string;
  chunkIndex: number;
  text: string;
}

export async function chunkDocuments(docs: SourceDocument[]): Promise<DocumentChunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: env.RAG_CHUNK_SIZE,
    chunkOverlap: env.RAG_CHUNK_OVERLAP,
    separators: ["\n\n", "\n", ". ", "? ", "! ", " ", ""],
  });

  const allChunks: DocumentChunk[] = [];

  for (const doc of docs) {
    const pieces = await splitter.splitText(doc.content);
    pieces.forEach((text, idx) => {
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        allChunks.push({ source: doc.source, chunkIndex: idx, text: trimmed });
      }
    });
  }

  return allChunks;
}
