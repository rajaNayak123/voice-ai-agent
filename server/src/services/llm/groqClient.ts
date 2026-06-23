
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

export async function getChatCompletion(opts: { messages: ChatMessage[]; signal?: AbortSignal }): Promise<string> {
  const client = getClient();
  const completion = await client.chat.completions.create(
    {
      model: env.GROQ_MODEL,
      messages: opts.messages,
      temperature: env.GROQ_TEMPERATURE,
      max_tokens: env.GROQ_MAX_TOKENS,
    },
    { signal: opts.signal }
  );
  return completion.choices[0]?.message?.content || "";
}

