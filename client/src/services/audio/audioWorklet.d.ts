/**
 * Minimal ambient declarations for the AudioWorklet global scope. TS's
 * default DOM lib doesn't include these (they run in a separate global
 * scope from the main thread), so we declare just what
 * services/audio/pcm16Worklet.ts needs rather than pulling in a full
 * extra @types package for one file.
 */

declare const sampleRate: number;

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor
): void;
