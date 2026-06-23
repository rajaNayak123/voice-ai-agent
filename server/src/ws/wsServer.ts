
import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import { ConversationSession } from "./conversationSession.js";
import { childLogger } from "../utils/logger.js";
import type { ClientMessage } from "../types/index.js";

const log = childLogger("ws-server");

export function attachWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/voice" });

  wss.on("connection", (ws: WebSocket) => {
    log.info("client connected");
    const session = new ConversationSession(ws);
    session.start();

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        session.handleAudioFrame(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
        return;
      }
      try {
        const parsed = JSON.parse(data.toString()) as ClientMessage;
        session.handleClientMessage(parsed);
      } catch (err) {
        log.warn({ err }, "failed to parse client message");
      }
    });

    ws.on("close", () => {
      log.info("client disconnected");
      session.teardown();
    });

    ws.on("error", (err) => {
      log.error({ err }, "websocket error");
    });
  });

  return wss;
}
