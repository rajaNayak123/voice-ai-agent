/**
 * Captures microphone audio and emits 16kHz PCM16 frames via a callback,
 * ready to be sent straight to Deepgram over the WebSocket.
 *
 * Uses the Web Audio API's AudioWorklet (rather than the deprecated
 * ScriptProcessorNode) for capture, which runs on a dedicated audio
 * thread and avoids blocking/being blocked by the main thread — important
 * for keeping mic capture glitch-free while the UI re-renders streaming
 * transcript/response text.
 */

/**
 * The AudioWorklet module is served as a static asset (see
 * public/worklets/pcm16-worklet.js) rather than imported/bundled. Vite
 * copies everything in /public verbatim to the build output root, so
 * this path is stable in both dev and production. See that file's
 * header comment for why AudioWorklets can't be bundled like a normal
 * ES module import.
 */
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
      // Note: we intentionally do NOT connect workletNode -> destination,
      // since we don't want to play the user's own mic input back to them.

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
