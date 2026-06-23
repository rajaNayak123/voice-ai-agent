/**
 * Streaming chat completion client for Groq's Llama 3.1 8B Instant model.
 *
 * Groq's LPU inference is dramatically faster than typical GPU-hosted
 * inference for small/medium models — first-token latency is usually
 * well under 200-300ms and token throughput is very high, which is
 * exactly what a "speak before the response finishes" pipeline needs.
 *
 * Streaming is consumed as an async generator so the caller (the
 * WebSocket session orchestrator) can pipe tokens directly into the
 * sentence detector and abort cleanly via AbortController on barge-in.
 */
import Groq from "groq-sdk";
import { env } from "../../utils/env.js";
import { childLogger } from "../../utils/logger.js";
import type { ChatMessage } from "./prompt.js";

const log = childLogger("llm");

let _client: Groq | null = null;

function getClient(): Groq {
  if (!_client) {
    _client = new Groq({
      apiKey: env.GROQ_API_KEY,
      fetch: globalThis.fetch,
    });
  }
  return _client;
}

export interface StreamChatOptions {
  messages: ChatMessage[];
  signal?: AbortSignal;
}

/**
 * Streams completion tokens as they arrive from Groq. Yields plain text
 * deltas. Throws (and stops yielding) if the AbortSignal fires —
 * AbortController is wired through from the WS session so barge-in can
 * cancel an in-flight generation immediately.
 */
export async function* streamChatCompletion(
  opts: StreamChatOptions
): AsyncGenerator<string, void, unknown> {
  const client = getClient();

  const stream = await client.chat.completions.create(
    {
      model: env.GROQ_MODEL,
      messages: opts.messages,
      temperature: env.GROQ_TEMPERATURE,
      max_tokens: env.GROQ_MAX_TOKENS,
      stream: true,
    },
    { signal: opts.signal }
  );

  try {
    for await (const chunk of stream) {
      if (opts.signal?.aborted) {
        log.info("LLM stream aborted by caller (barge-in)");
        return;
      }
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  } catch (err) {
    if (opts.signal?.aborted) {
      log.info("LLM stream aborted (error path)");
      return;
    }
    log.error({ err }, "error while streaming Groq completion");
    throw err;
  }
}
