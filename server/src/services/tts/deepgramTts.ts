/**
 * Streaming text-to-speech via Deepgram Aura.
 *
 * We use Aura's REST streaming endpoint (one call per sentence) rather
 * than a persistent TTS WebSocket: since the pipeline already produces
 * discrete sentence-sized text units (see utils/sentenceDetector.ts),
 * issuing one streaming HTTP request per sentence is simpler to reason
 * about and to cancel (one AbortController per sentence, or one shared
 * controller for the whole turn on barge-in) while still streaming audio
 * back chunk-by-chunk as it's synthesized — Aura starts returning audio
 * bytes well before the full sentence's audio is ready.
 */
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

/**
 * Synthesizes one sentence of speech and streams back audio chunks
 * (Buffers) as they're produced. Caller is expected to forward each
 * chunk to the client over the WebSocket immediately (base64-encoded)
 * rather than waiting for the full buffer, to minimize time-to-first-audio.
 */
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
    // eslint-disable-next-line no-constant-condition
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
      /* already released */
    }
  }
}
