
const SENTENCE_END_RE = /([.!?।॥]+)(\s|$)/;

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

  minSentenceLength?: number;

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

  push(token: string): string[] {
    this.buffer += token;
    const sentences: string[] = [];

    let searchStart = 0;

    while (true) {
      const rest = this.buffer.slice(searchStart);
      const match = SENTENCE_END_RE.exec(rest);
      if (!match || match.index === undefined) break;

      const matchIndexInBuffer = searchStart + match.index;
      const candidateEnd = matchIndexInBuffer + match[0].length;
      const candidate = this.buffer.slice(0, candidateEnd).trim();

      if (this.isFalsePositive(candidate)) {

        searchStart = candidateEnd;
        continue;
      }

      if (candidate.length < this.minLen) {

        searchStart = candidateEnd;
        continue;
      }

      sentences.push(candidate);
      this.buffer = this.buffer.slice(candidateEnd).trimStart();
      searchStart = 0;
    }

    if (this.buffer.length > this.maxLen) {
      const clauseBreak = this.findClauseBreak(this.buffer);
      if (clauseBreak > this.minLen) {
        sentences.push(this.buffer.slice(0, clauseBreak).trim());
        this.buffer = this.buffer.slice(clauseBreak).trimStart();
      }
    }

    return sentences;
  }

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
