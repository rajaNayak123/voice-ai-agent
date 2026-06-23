
import type { SupportedLanguage } from "../../types/index.js";

const DEVANAGARI_RE = /[\u0900-\u097F]/;

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

  if (hinglishMarkerCount >= 1 && hasLatinWords) {

    const ratio = hinglishMarkerCount / Math.max(lowerWords.length, 1);
    return ratio > 0.6 ? "hi" : "hinglish";
  }

  if (deepgramHint === "hi") return "hi";

  return "en";
}

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
