/**
 * PerformanceMonitor — 效能監控
 * 計算 FPS、Latency、Frame time
 */

export class PerformanceMonitor {
  constructor() {
    this.inferenceTimes = [];
    this.frameTimes = [];
    this.lastFrameTime = 0;
    this.maxSamples = 30;
  }

  beginInference() {
    this.lastFrameTime = performance.now();
  }

  endInference() {
    const now = performance.now();
    const duration = now - this.lastFrameTime;
    this.inferenceTimes.push(duration);
    if (this.inferenceTimes.length > this.maxSamples) {
      this.inferenceTimes.shift();
    }
  }

  recordFrame() {
    const now = performance.now();
    if (this.frameTimes.length > 0) {
      const interval = now - this.frameTimes[this.frameTimes.length - 1];
      // We track intervals between frames
    }
    this.frameTimes.push(now);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
  }

  getFPS() {
    if (this.frameTimes.length < 2) return 0;
    const intervals = [];
    for (let i = 1; i < this.frameTimes.length; i++) {
      intervals.push(this.frameTimes[i] - this.frameTimes[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return avgInterval > 0 ? Math.round(1000 / avgInterval) : 0;
  }

  getLatency() {
    if (this.inferenceTimes.length === 0) return 0;
    const sum = this.inferenceTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.inferenceTimes.length);
  }

  reset() {
    this.inferenceTimes = [];
    this.frameTimes = [];
  }
}
