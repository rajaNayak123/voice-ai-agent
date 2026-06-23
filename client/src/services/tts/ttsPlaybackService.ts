
import { AudioPlaybackQueue } from "../audio/audioPlaybackQueue";

export class TtsPlaybackService {
  private queue = new AudioPlaybackQueue();

  setCallbacks(cb: { onPlaybackStart?: () => void; onQueueEmpty?: () => void; onFirstAudio?: () => void }): void {
    this.queue.setCallbacks(cb);
  }

  async playSentenceAudio(audioBase64: string, sentenceIndex: number): Promise<void> {
    await this.queue.enqueueBase64Wav(audioBase64, sentenceIndex);
  }

  interrupt(): void {
    this.queue.stopImmediately();
  }

  startNewTurn(): void {
    this.queue.reset();
  }

  destroy(): void {
    this.queue.destroy();
  }
}
