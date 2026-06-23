/**
 * Generic retry helper with exponential backoff + jitter. Used for
 * idempotent network calls (embeddings, vector search, REST calls) where
 * a transient failure shouldn't bubble all the way up to the user.
 *
 * NOT used for streaming connections (WebSocket STT/TTS) — those have
 * their own reconnect logic in services/stt and services/tts because
 * "retry" for a stream means "reconnect and resume", not "redo the call".
 */
import { childLogger } from "./logger.js";

const log = childLogger("retry");

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;
  /** Return false to stop retrying for a given error (e.g. 4xx client errors). */
  shouldRetry?: (err: unknown) => boolean;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 250,
    maxDelayMs = 4000,
    label = "operation",
    shouldRetry = () => true,
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLastAttempt = attempt === retries;
      if (isLastAttempt || !shouldRetry(err)) {
        log.warn({ err, attempt, label }, "retry exhausted or non-retryable error");
        throw err;
      }
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt) * (0.7 + Math.random() * 0.6);
      log.warn({ attempt, delay: Math.round(delay), label }, "retrying after failure");
      await sleep(delay);
    }
  }
  throw lastErr;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
