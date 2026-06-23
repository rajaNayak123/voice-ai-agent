/**
 * Plays back streamed TTS audio chunks (base64 WAV produced per-sentence
 * by Deepgram Aura) using the Web Audio API, queued so sentence N+1
 * starts immediately after sentence N finishes — giving continuous
 * speech even though each sentence's audio arrives as a separate stream.
 *
 * Critically supports `stopImmediately()` for barge-in: when the user
 * starts talking while the agent is speaking, we need playback to cut
 * off within milliseconds, not "after the current buffer finishes".
 */

export class AudioPlaybackQueue {
  private audioContext: AudioContext;
  private pending = new Map<number, AudioBuffer>();
  private nextIndexToPlay = 0;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlaying = false;
  private stopped = false;
  private onPlaybackStart?: () => void;
  private onQueueEmpty?: () => void;
  private firstAudioPlayed = false;
  private onFirstAudio?: () => void;

  constructor() {
    this.audioContext = new AudioContext();
  }

  setCallbacks(cb: { onPlaybackStart?: () => void; onQueueEmpty?: () => void; onFirstAudio?: () => void }): void {
    this.onPlaybackStart = cb.onPlaybackStart;
    this.onQueueEmpty = cb.onQueueEmpty;
    this.onFirstAudio = cb.onFirstAudio;
  }

  /** Decode and enqueue a base64-encoded WAV chunk for playback. Sentences may
   * arrive out of order (synthesis runs concurrently per-sentence on the
   * server) — we hold each decoded clip until it's its turn by sentenceIndex. */
  async enqueueBase64Wav(base64: string, sentenceIndex: number): Promise<void> {
    if (this.stopped) return;
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    const bytes = base64ToUint8Array(base64);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    let decoded: AudioBuffer;
    try {
      decoded = await this.audioContext.decodeAudioData(arrayBuffer);
    } catch {
      // Malformed/empty audio for this sentence — skip it rather than
      // stalling the whole queue waiting for an index that will never arrive.
      decoded = this.audioContext.createBuffer(1, 1, this.audioContext.sampleRate);
    }

    if (this.stopped) return;
    this.pending.set(sentenceIndex, decoded);
    this.playNextIfIdle();
  }

  private playNextIfIdle(): void {
    if (this.isPlaying || this.stopped) return;
    const next = this.pending.get(this.nextIndexToPlay);
    if (!next) {
      // Either we're caught up and waiting on more audio, or genuinely done.
      if (this.pending.size === 0) this.onQueueEmpty?.();
      return;
    }
    this.pending.delete(this.nextIndexToPlay);
    this.nextIndexToPlay++;

    this.isPlaying = true;
    if (!this.firstAudioPlayed) {
      this.firstAudioPlayed = true;
      this.onFirstAudio?.();
    }
    this.onPlaybackStart?.();

    const source = this.audioContext.createBufferSource();
    source.buffer = next;
    source.connect(this.audioContext.destination);
    source.onended = () => {
      this.isPlaying = false;
      this.currentSource = null;
      if (!this.stopped) this.playNextIfIdle();
    };

    this.currentSource = source;
    source.start();
  }

  /** Immediately halt playback and drop any queued (not-yet-played) audio. Used for barge-in. */
  stopImmediately(): void {
    this.stopped = true;
    this.pending.clear();
    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
      } catch {
        /* already stopped */
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
  }

  /** Re-arm the queue for the next agent turn after a stop. */
  reset(): void {
    this.stopped = false;
    this.firstAudioPlayed = false;
    this.pending.clear();
    this.nextIndexToPlay = 0;
    this.isPlaying = false;
  }

  destroy(): void {
    this.stopImmediately();
    this.audioContext.close().catch(() => undefined);
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
