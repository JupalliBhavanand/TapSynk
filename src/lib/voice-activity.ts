/** Conservative speech gate: ambient calibration, sustained onset and short release. */
export class VoiceActivity {
  private noise = 0.006;
  private calibration: number[] = [];
  private onsetMs = 0;
  private calibrationMs: number;
  speechMs = 0;
  firstVoiceMs: number | null = null;
  lastVoiceMs = 0;

  constructor(previousNoise?: number) {
    this.calibrationMs = previousNoise === undefined ? 250 : 0;
    if (previousNoise !== undefined) this.noise = Math.max(0.002, previousNoise);
  }

  update(rms: number, elapsedMs: number, frameMs: number) {
    if (elapsedMs < this.calibrationMs) {
      this.calibration.push(rms);
      const sorted = [...this.calibration].sort((a, b) => a - b);
      this.noise = Math.max(0.002, sorted[Math.floor(sorted.length / 2)] ?? this.noise);
      return false;
    }
    const voiced = rms > Math.max(0.012, this.noise * 2.8);
    if (voiced) {
      this.onsetMs += frameMs;
      if (this.onsetMs >= 100) {
        if (this.firstVoiceMs === null) this.firstVoiceMs = elapsedMs - this.onsetMs;
        this.speechMs += frameMs;
        this.lastVoiceMs = elapsedMs;
        return true;
      }
    } else {
      this.onsetMs = 0;
      this.noise = this.noise * 0.97 + rms * 0.03;
    }
    return false;
  }

  get heard() { return this.speechMs >= 180; }
  get noiseFloor() { return this.noise; }

  /** Quick acknowledgements finish promptly; longer answers allow thinking pauses. */
  get pauseMs() { return this.speechMs < 600 ? 650 : this.speechMs < 1800 ? 1000 : 1200; }
}
