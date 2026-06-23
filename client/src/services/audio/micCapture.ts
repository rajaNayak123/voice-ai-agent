
const WORKLET_URL = "/worklets/pcm16-worklet.js";

export interface MicCaptureHandlers {
  onAudioFrame: (frame: ArrayBuffer) => void;
  onError: (err: Error) => void;
}

export class MicCaptureService {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isCapturing = false;

  async start(handlers: MicCaptureHandlers): Promise<void> {
    if (this.isCapturing) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioContext = new AudioContext();
      await this.audioContext.audioWorklet.addModule(WORKLET_URL);

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, "pcm16-capture-processor");

      this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        handlers.onAudioFrame(event.data);
      };

      this.sourceNode.connect(this.workletNode);

      this.isCapturing = true;
    } catch (err) {
      handlers.onError(err instanceof Error ? err : new Error("Failed to start microphone capture"));
      this.stop();
    }
  }

  stop(): void {
    this.isCapturing = false;
    this.workletNode?.disconnect();
    this.sourceNode?.disconnect();
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.audioContext?.close().catch(() => undefined);

    this.workletNode = null;
    this.sourceNode = null;
    this.mediaStream = null;
    this.audioContext = null;
  }

  get active(): boolean {
    return this.isCapturing;
  }
}
