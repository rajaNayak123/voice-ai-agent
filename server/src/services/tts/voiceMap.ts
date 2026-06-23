
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
