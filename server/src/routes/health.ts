
import { Router } from "express";
import { collectionStats } from "../services/rag/qdrantClient.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger("health-route");
export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: process.uptime() });
});

healthRouter.get("/health/ready", async (_req, res) => {
  try {
    const stats = await collectionStats();
    res.json({ status: "ready", knowledgeBase: { chunks: stats.pointsCount } });
  } catch (err) {
    log.error({ err }, "readiness check failed: Qdrant unreachable");
    res.status(503).json({ status: "not_ready", reason: "vector_db_unreachable" });
  }
});
