
import { createClient } from "@deepgram/sdk";
import { env } from "../../utils/env.js";
import { childLogger } from "../../utils/logger.js";
import { voiceForLanguage } from "./voiceMap.js";
import type { SupportedLanguage } from "../../types/index.js";

const log = childLogger("tts");

let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!_client) {
    _client = createClient(env.DEEPGRAM_API_KEY);
  }
  return _client;
}

export interface SynthesizeOptions {
  text: string;
  language: SupportedLanguage;
  signal?: AbortSignal;
}

export async function* synthesizeSpeechStream(
  opts: SynthesizeOptions
): AsyncGenerator<Buffer, void, unknown> {
  const client = getClient();
  const model = voiceForLanguage(opts.language);

  if (opts.signal?.aborted) return;

  const response = await client.speak.request(
    { text: opts.text },
    {
      model,
      encoding: "linear16",
      sample_rate: 24000,
      container: "wav",
    }
  );

  const stream = await response.getStream();
  if (!stream) {
    log.error({ text: opts.text }, "Deepgram TTS returned no audio stream");
    throw new Error("TTS stream unavailable");
  }

  const reader = stream.getReader();
  try {

    while (true) {
      if (opts.signal?.aborted) {
        log.info("TTS stream aborted by caller (barge-in)");
        await reader.cancel();
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value) yield Buffer.from(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {

    }
  }
}
