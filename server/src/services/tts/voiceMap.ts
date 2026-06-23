/**
 * Maps our internal language tags to a Deepgram Aura voice model.
 *
 * Aura's catalog is primarily English voices. For Hindi/Hinglish output
 * we still route through an Aura English voice (Aura handles romanized
 * and code-mixed text reasonably well prosody-wise), but this map is the
 * single place to swap in a dedicated Hindi-tuned voice/model as Deepgram
 * (or another TTS provider) adds one — the rest of the pipeline doesn't
 * need to change.
 */
import type { SupportedLanguage } from "../../types/index.js";
import { env } from "../../utils/env.js";

const VOICE_MAP: Record<SupportedLanguage, string> = {
  en: env.DEEPGRAM_TTS_MODEL || "aura-asteria-en",
  hi: env.DEEPGRAM_TTS_MODEL || "aura-asteria-en",
  hinglish: env.DEEPGRAM_TTS_MODEL || "aura-asteria-en",
};

export function voiceForLanguage(lang: SupportedLanguage): string {
  return VOICE_MAP[lang] ?? VOICE_MAP.en;
}
