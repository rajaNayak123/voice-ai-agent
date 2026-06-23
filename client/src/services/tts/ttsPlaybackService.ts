/**
 * Client-side TTS playback service. Wraps AudioPlaybackQueue (the raw
 * Web Audio mechanics) with the higher-level contract the rest of the
 * app cares about: feed it base64 WAV audio events from the server as
 * they arrive, and it handles decode/queueing/sequential playback,
 * exposing simple lifecycle callbacks for the agent state machine.
 */
import { AudioPlaybackQueue } from "../audio/audioPlaybackQueue";

export class TtsPlaybackService {
  private queue = new AudioPlaybackQueue();

  setCallbacks(cb: { onPlaybackStart?: () => void; onQueueEmpty?: () => void; onFirstAudio?: () => void }): void {
    this.queue.setCallbacks(cb);
  }

  async playSentenceAudio(audioBase64: string, sentenceIndex: number): Promise<void> {
    await this.queue.enqueueBase64Wav(audioBase64, sentenceIndex);
  }

  /** Barge-in: cut audio immediately. */
  interrupt(): void {
    this.queue.stopImmediately();
  }

  /** Prepare for the next agent turn. */
  startNewTurn(): void {
    this.queue.reset();
  }

  destroy(): void {
    this.queue.destroy();
  }
}
