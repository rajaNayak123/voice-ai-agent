/**
 * Incremental sentence boundary detector.
 *
 * The LLM streams tokens one at a time. We can't wait for the full
 * response before starting TTS — that would defeat the entire point of
 * streaming. Instead, we buffer tokens and flush a "sentence" as soon as
 * we see a sentence-ending punctuation mark, so the first sentence can be
 * sent to TTS while the LLM is still generating the rest.
 *
 * Handles both English punctuation (. ! ?) and Hindi/Devanagari sentence
 * punctuation (the "purna viram" । and ॥), plus Hinglish text which may
 * mix both. Also guards against common false positives like "Mr.",
 * "₹4,999.50", decimal numbers, and ellipses, so we don't fire TTS on a
 * tiny fragment.
 */

const SENTENCE_END_RE = /([.!?।॥]+)(\s|$)/;

// Abbreviations / patterns after which a "." should NOT be treated as a
// sentence boundary (common in English support/business chat).
const ABBREVIATIONS = new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "vs.",
  "etc.",
  "e.g.",
  "i.e.",
  "approx.",
  "no.",
]);

export interface SentenceDetectorOptions {
  /** Minimum characters before we ever flush a sentence (avoids "Ok." being its own beat). */
  minSentenceLength?: number;
  /** Force-flush whatever is buffered if it grows beyond this, even without punctuation. */
  maxBufferLength?: number;
}

export class SentenceDetector {
  private buffer = "";
  private readonly minLen: number;
  private readonly maxLen: number;

  constructor(opts: SentenceDetectorOptions = {}) {
    this.minLen = opts.minSentenceLength ?? 4;
    this.maxLen = opts.maxBufferLength ?? 220;
  }

  /**
   * Feed the next token/chunk of text. Returns zero or more complete
   * sentences that are ready to be sent downstream to TTS.
   */
  push(token: string): string[] {
    this.buffer += token;
    const sentences: string[] = [];

    let searchStart = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rest = this.buffer.slice(searchStart);
      const match = SENTENCE_END_RE.exec(rest);
      if (!match || match.index === undefined) break;

      const matchIndexInBuffer = searchStart + match.index;
      const candidateEnd = matchIndexInBuffer + match[0].length;
      const candidate = this.buffer.slice(0, candidateEnd).trim();

      if (this.isFalsePositive(candidate)) {
        // Skip past this punctuation mark and keep scanning forward
        searchStart = candidateEnd;
        continue;
      }

      if (candidate.length < this.minLen) {
        // Too short to be a meaningful sentence on its own; wait for more
        // by continuing the scan from after this punctuation mark.
        searchStart = candidateEnd;
        continue;
      }

      sentences.push(candidate);
      this.buffer = this.buffer.slice(candidateEnd).trimStart();
      searchStart = 0;
    }

    // Safety valve: if the model produces a very long run with no
    // punctuation (rare, but possible), flush at a clause boundary so TTS
    // doesn't stall indefinitely waiting for full-stop punctuation.
    if (this.buffer.length > this.maxLen) {
      const clauseBreak = this.findClauseBreak(this.buffer);
      if (clauseBreak > this.minLen) {
        sentences.push(this.buffer.slice(0, clauseBreak).trim());
        this.buffer = this.buffer.slice(clauseBreak).trimStart();
      }
    }

    return sentences;
  }

  /** Call when the LLM stream ends — flushes any trailing partial sentence. */
  flush(): string[] {
    const trimmed = this.buffer.trim();
    this.buffer = "";
    return trimmed.length > 0 ? [trimmed] : [];
  }

  reset(): void {
    this.buffer = "";
  }

  private isFalsePositive(candidate: string): boolean {
    const lower = candidate.toLowerCase();
    for (const abbr of ABBREVIATIONS) {
      if (lower.endsWith(abbr)) return true;
    }
    // Decimal numbers / currency like "₹4,999.50 per" mid-sentence — the
    // char before the "." is a digit AND the char after is a digit.
    const dotIdx = candidate.lastIndexOf(".");
    if (dotIdx > 0 && dotIdx < candidate.length - 1) {
      const before = candidate[dotIdx - 1];
      const after = candidate[dotIdx + 1];
      if (/\d/.test(before) && /\d/.test(after)) return true;
    }
    return false;
  }

  private findClauseBreak(text: string): number {
    const commaIdx = text.lastIndexOf(",", this.maxLen);
    const spaceIdx = text.lastIndexOf(" ", this.maxLen);
    return commaIdx > this.minLen ? commaIdx + 1 : spaceIdx;
  }
}
