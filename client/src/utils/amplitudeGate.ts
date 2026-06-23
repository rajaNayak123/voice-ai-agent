
export interface AmplitudeGateOptions {

  threshold?: number;

  requiredConsecutiveFrames?: number;
}

export class AmplitudeGate {
  private readonly threshold: number;
  private readonly requiredFrames: number;
  private consecutiveAboveThreshold = 0;

  constructor(opts: AmplitudeGateOptions = {}) {
    this.threshold = opts.threshold ?? 0.02;
    this.requiredFrames = opts.requiredConsecutiveFrames ?? 2;
  }

  feed(pcm16: Int16Array): boolean {
    const rms = computeRms(pcm16);
    if (rms > this.threshold) {
      this.consecutiveAboveThreshold++;
      if (this.consecutiveAboveThreshold >= this.requiredFrames) {
        this.consecutiveAboveThreshold = 0;
        return true;
      }
    } else {
      this.consecutiveAboveThreshold = 0;
    }
    return false;
  }

  reset(): void {
    this.consecutiveAboveThreshold = 0;
  }
}

function computeRms(samples: Int16Array): number {
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const normalized = samples[i] / 32768;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / samples.length);
}
