
import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./utils/env.js";
import { logger } from "./utils/logger.js";
import { healthRouter } from "./routes/health.js";
import { ragDebugRouter } from "./routes/ragDebug.js";
import { attachWebSocketServer } from "./ws/wsServer.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.use("/api", healthRouter);
app.use("/api", ragDebugRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "unhandled express error");
  res.status(500).json({ error: "Internal server error" });
});

const httpServer = http.createServer(app);
attachWebSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, wsPath: "/ws/voice" },
    `🎙️  Voice AI Agent server listening on http://localhost:${env.PORT}`
  );
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandled promise rejection");
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  httpServer.close(() => process.exit(0));
});
