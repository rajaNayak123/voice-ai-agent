
import { Router } from "express";
import { z } from "zod";
import { retrieveRelevantChunks } from "../services/rag/retriever.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger("rag-debug-route");
export const ragDebugRouter = Router();

const QuerySchema = z.object({ query: z.string().min(1).max(500) });

ragDebugRouter.post("/rag/query", async (req, res) => {
  const parsed = QuerySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  try {
    const result = await retrieveRelevantChunks(parsed.data.query);
    res.json(result);
  } catch (err) {
    log.error({ err }, "RAG debug query failed");
    res.status(500).json({ error: "Retrieval failed" });
  }
});
