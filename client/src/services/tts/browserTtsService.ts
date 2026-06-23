
export class BrowserTtsService {
  private queue: { text: string; lang: string; index: number }[] = [];
  private speaking = false;
  private stopped = false;
  private firstAudioPlayed = false;
  private onFirstAudio?: () => void;

  constructor(callbacks?: { onFirstAudio?: () => void }) {
    this.onFirstAudio = callbacks?.onFirstAudio;
  }

  enqueue(text: string, lang: "hi" | "hinglish", index: number): void {
    if (this.stopped) return;
    this.queue.push({ text, lang, index });
    this.queue.sort((a, b) => a.index - b.index);
    this.playNextIfIdle();
  }

  private playNextIfIdle(): void {
    if (this.speaking || this.stopped || this.queue.length === 0) return;
    const next = this.queue.shift()!;
    this.speaking = true;

    if (!this.firstAudioPlayed) {
      this.firstAudioPlayed = true;
      this.onFirstAudio?.();
    }

    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.lang = "hi-IN"; 
    utterance.rate = 1.0;

    utterance.onend = () => {
      this.speaking = false;
      if (!this.stopped) this.playNextIfIdle();
    };
    utterance.onerror = () => {
      this.speaking = false;
      if (!this.stopped) this.playNextIfIdle();
    };

    window.speechSynthesis.speak(utterance);
  }

  stopImmediately(): void {
    this.stopped = true;
    this.queue = [];
    window.speechSynthesis.cancel();
    this.speaking = false;
  }

  reset(): void {
    this.stopped = false;
    this.firstAudioPlayed = false;
  }
}
