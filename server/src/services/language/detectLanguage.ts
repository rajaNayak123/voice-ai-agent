/**
 * Lightweight heuristic language detector for English / Hindi / Hinglish.
 *
 * Deepgram's `multi` language mode gives us a detected language per
 * utterance (e.g. "en", "hi"), but it doesn't have a "Hinglish" category —
 * code-switched text is usually tagged as one or the other, or alternates
 * word-by-word. We refine that signal here by looking at the actual
 * transcript: presence of Devanagari script vs. romanized Hindi
 * function-words mixed with English tells us whether this is "pure"
 * Hindi/English or genuinely mixed Hinglish (which needs its own
 * response style — Hindi sentence structure with English nouns, in Latin
 * script).
 */
import type { SupportedLanguage } from "../../types/index.js";

const DEVANAGARI_RE = /[\u0900-\u097F]/;

// Common Romanized Hindi tokens that signal Hinglish even with no
// Devanagari script present (e.g. "NovaDesk ki pricing kya hai?").
const HINGLISH_MARKERS = [
  "kya",
  "hai",
  "hain",
  "ka",
  "ki",
  "ke",
  "kaise",
  "kyu",
  "kyun",
  "nahi",
  "nahin",
  "haan",
  "mera",
  "meri",
  "tumhara",
  "aap",
  "aapka",
  "kitna",
  "kitne",
  "batao",
  "bata",
  "chahiye",
  "matlab",
  "acha",
  "theek",
  "thik",
];

export function detectLanguage(text: string, deepgramHint?: string): SupportedLanguage {
  const hasDevanagari = DEVANAGARI_RE.test(text);
  const lowerWords = text.toLowerCase().split(/\s+/).filter(Boolean);
  const hinglishMarkerCount = lowerWords.filter((w) =>
    HINGLISH_MARKERS.includes(w.replace(/[^\p{L}]/gu, ""))
  ).length;

  const hasLatinWords = /[a-zA-Z]/.test(text);

  if (hasDevanagari && hasLatinWords) {
    return "hinglish";
  }

  if (hasDevanagari && !hasLatinWords) {
    return "hi";
  }

  // No Devanagari script — check for romanized Hindi mixed with English.
  if (hinglishMarkerCount >= 1 && hasLatinWords) {
    // If basically every word is a Hindi marker/function word with no
    // English content words, treat as (romanized) Hindi rather than
    // Hinglish, since there's no English mixed in.
    const ratio = hinglishMarkerCount / Math.max(lowerWords.length, 1);
    return ratio > 0.6 ? "hi" : "hinglish";
  }

  if (deepgramHint === "hi") return "hi";

  return "en";
}

/** Human-readable label for UI display. */
export function languageLabel(lang: SupportedLanguage): string {
  switch (lang) {
    case "en":
      return "English";
    case "hi":
      return "Hindi";
    case "hinglish":
      return "Hinglish";
  }
}
