
export class BrowserTtsService {
  private pending = new Map<number, { text: string; lang: string }>();
  private nextIndexToPlay = 0;
  private stopped = false;
  private firstAudioPlayed = false;
  private onFirstAudio?: () => void;
  // Keep an array of utterances to prevent garbage collection
  private activeUtterances: SpeechSynthesisUtterance[] = []; 

  constructor(callbacks?: { onFirstAudio?: () => void }) {
    this.onFirstAudio = callbacks?.onFirstAudio;
    // Trigger voice loading eagerly
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }

  enqueue(text: string, lang: "hi" | "hinglish", index: number): void {
    if (this.stopped) return;
    this.pending.set(index, { text, lang });
    this.flushAvailable();
  }

  private flushAvailable(): void {
    if (this.stopped) return;
    
    // Resume in case the browser paused it automatically
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    while (true) {
      const next = this.pending.get(this.nextIndexToPlay);
      if (!next) break;

      this.pending.delete(this.nextIndexToPlay);
      this.nextIndexToPlay++;

      const utterance = new SpeechSynthesisUtterance(next.text);
      this.activeUtterances.push(utterance); // prevent GC

      utterance.lang = "hi-IN"; 
      utterance.rate = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const hiVoice = voices.find((v) => v.lang.replace("_", "-").toLowerCase().startsWith("hi"));
      if (hiVoice) {
        utterance.voice = hiVoice;
      }

      utterance.onstart = () => {
        if (!this.firstAudioPlayed) {
          this.firstAudioPlayed = true;
          this.onFirstAudio?.();
        }
      };

      utterance.onend = () => {
        // Cleanup reference once finished to prevent memory leak
        this.activeUtterances = this.activeUtterances.filter((u) => u !== utterance);
      };

      utterance.onerror = (e) => {
        console.error("Browser TTS error:", e);
        this.activeUtterances = this.activeUtterances.filter((u) => u !== utterance);
      };

      // Push to the browser's native queue immediately
      window.speechSynthesis.speak(utterance);
    }
  }

  stopImmediately(): void {
    this.stopped = true;
    this.pending.clear();
    window.speechSynthesis.cancel();
    this.activeUtterances = [];
  }

  reset(): void {
    this.stopped = false;
    this.firstAudioPlayed = false;
    this.pending.clear();
    this.nextIndexToPlay = 0;
  }
}
