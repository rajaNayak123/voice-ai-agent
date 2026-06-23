
import { childLogger } from "./logger.js";

const log = childLogger("retry");

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;

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
