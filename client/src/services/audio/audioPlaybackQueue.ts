
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

      decoded = this.audioContext.createBuffer(1, 1, this.audioContext.sampleRate);
    }

    if (this.stopped) return;
    this.pending.set(sentenceIndex, decoded);
    this.playNextIfIdle();
  }

  private nextStartTime = 0;

  private playNextIfIdle(): void {
    if (this.stopped) return;

    while (true) {
      const next = this.pending.get(this.nextIndexToPlay);
      if (!next) {
        if (this.pending.size === 0) this.onQueueEmpty?.();
        break;
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

      const currentTime = this.audioContext.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += next.duration;

      source.onended = () => {
        if (this.audioContext.currentTime >= this.nextStartTime) {
          this.isPlaying = false;
        }
      };
      
      this.currentSource = source;
    }
  }

  stopImmediately(): void {
    this.stopped = true;
    this.pending.clear();
    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
      } catch {

      }
      this.currentSource = null;
    }
    this.isPlaying = false;
  }

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
