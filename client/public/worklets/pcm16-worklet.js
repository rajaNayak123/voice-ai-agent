/**
 * AudioWorkletProcessor for PCM16 mic capture, served as a static asset
 * from /public/worklets/ rather than bundled by Vite.
 *
 * AudioWorklet modules run in a separate, isolated JS realm
 * (AudioWorkletGlobalScope) and are loaded via
 * `audioContext.audioWorklet.addModule(url)`, which performs an actual
 * network fetch for a standalone script — they cannot be bundled inline
 * with the rest of the app the way a normal ES module import can.
 * Keeping this as a hand-written plain-JS file in /public guarantees it
 * is copied byte-for-byte to the build output at a stable, fetchable URL
 * (/worklets/pcm16-worklet.js), regardless of how the rest of the app is
 * bundled/minified/code-split.
 *
 * This file is the build/runtime source of truth. A TypeScript-authored
 * copy with full type annotations lives at
 * src/services/audio/pcm16Worklet.ts for readability/reference and to
 * keep the typed contract documented, but it is NOT imported or built —
 * keep the two in sync if you change the resampling/encoding logic.
 */

class PCM16CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputSampleRate = sampleRate;
    this.targetSampleRate = 16000;
    this.resampleRatio = this.inputSampleRate / this.targetSampleRate;
    this.carry = [];
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input || input.length === 0) return true;

    const downsampled = this.downsample(input);
    const pcm16 = this.floatTo16BitPCM(downsampled);
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }

  downsample(input) {
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

  floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }
}

registerProcessor("pcm16-capture-processor", PCM16CaptureProcessor);
