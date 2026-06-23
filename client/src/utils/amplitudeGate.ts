/**
 * Very lightweight client-side voice activity detection used purely to
 * trigger an *instant* local barge-in (stop playback the moment the user
 * starts talking, without waiting for a round-trip to the server).
 *
 * This is intentionally crude (RMS amplitude over a short window) — it
 * does not need to be a high-quality VAD because it only ever triggers a
 * "maybe the user is speaking" signal that:
 *   (a) immediately mutes local TTS playback for responsiveness, and
 *   (b) sends a `barge_in` message to the server, which independently
 *       confirms via Deepgram's own VAD/transcript activity.
 * False positives just cause a brief unnecessary interruption check; the
 * server is the source of truth for whether a real utterance occurred.
 */

export interface AmplitudeGateOptions {
  /** RMS threshold (0-1) above which audio is considered "speech-like". */
  threshold?: number;
  /** Consecutive frames above threshold required before firing, to avoid clicks/pops triggering it. */
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

  /** Feed raw PCM16 samples; returns true exactly once activity is confirmed (then resets). */
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
