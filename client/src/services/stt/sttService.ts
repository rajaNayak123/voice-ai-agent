/**
 * Client-side STT "service" — note that the actual Deepgram streaming
 * connection lives on the SERVER (server/src/services/stt/deepgramStt.ts),
 * not in the browser. This file documents/types the client's view of STT:
 * we send raw mic audio frames over the WebSocket and receive partial/
 * final transcript events back. Kept as a thin re-export layer so the
 * folder structure mirrors server/src/services/* 1:1, and so a future
 * client-side STT provider (e.g. on-device Web Speech API fallback) has
 * an obvious home.
 */
export type { TranscriptChunk } from "./types";
