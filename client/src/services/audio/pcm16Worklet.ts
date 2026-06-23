/**
 * Reference/documentation copy of the AudioWorklet processor with full
 * TypeScript types. NOT bundled or loaded at runtime — AudioWorklet
 * modules must be fetched as standalone scripts via
 * `audioContext.audioWorklet.addModule(url)` and cannot be bundled
 * inline with the rest of the app. The actual file loaded at runtime is
 * the plain-JS copy at client/public/worklets/pcm16-worklet.js. Keep the
 * two in sync if you change the resampling/encoding logic — see that
 * file's header comment for the full explanation.
 */

class PCM16CaptureProcessor extends AudioWorkletProcessor {
  private inputSampleRate: number;
  private targetSampleRate = 16000;
  private resampleRatio: number;
  private carry: number[] = [];

  constructor() {
    super();
    // sampleRate is a global available inside AudioWorkletGlobalScope.
    this.inputSampleRate = sampleRate;
    this.resampleRatio = this.inputSampleRate / this.targetSampleRate;
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0) return true;

    const downsampled = this.downsample(input);
    const pcm16 = this.floatTo16BitPCM(downsampled);
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }

  private downsample(input: Float32Array): Float32Array {
    if (this.resampleRatio === 1) return input;

    const combined = this.carry.concat(Array.from(input));
    const outputLength = Math.floor(combined.length / this.resampleRatio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * this.resampleRatio;
      const lower = Math.floor(srcIndex);
      const upper = Math.min(lower + 1, combined.length - 1);
      const frac = srcIndex - lower;
      output[i] = combined[lower] * (1 - frac) + combined[upper] * frac;
    }

    const consumed = Math.floor(outputLength * this.resampleRatio);
    this.carry = combined.slice(consumed);
    return output;
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }
}

registerProcessor("pcm16-capture-processor", PCM16CaptureProcessor);
