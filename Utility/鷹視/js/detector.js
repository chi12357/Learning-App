/**
 * DetectionEngine — 物體偵測引擎
 * 依指定頻率執行 AI 推論，使用 KEEP_ONLY_LATEST 策略
 */

export class DetectionEngine {
  constructor(modelManager) {
    this.modelManager = modelManager;
    this.video = null;
    this.threshold = 0.5;
    this.targetFPS = 12;
    this.running = false;
    this.detecting = false;
    this.rafId = null;
    this.lastDetectTime = 0;
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  _emit(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs) cbs.forEach(cb => cb(data));
  }

  setVideo(video) {
    this.video = video;
  }

  setThreshold(value) {
    this.threshold = value;
  }

  setTargetFPS(fps) {
    this.targetFPS = fps;
  }

  async start() {
    if (this.running) return;
    if (!this.modelManager.isModelReady()) {
      throw new Error('Model not ready');
    }
    if (!this.video) {
      throw new Error('Video element not set');
    }

    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this._emit('stopped');
  }

  isRunning() {
    return this.running;
  }

  async _loop() {
    if (!this.running) return;

    const now = performance.now();
    const interval = 1000 / this.targetFPS;

    // Check if enough time has passed since last detection
    if (now - this.lastDetectTime >= interval && !this.detecting) {
      this.detecting = true;
      this.lastDetectTime = now;

      // KEEP_ONLY_LATEST: skip if video not ready
      if (this.video.readyState >= 2 && this.video.videoWidth > 0) {
        this._emit('inferenceStart');

        try {
          const predictions = await this.modelManager.getModel().detect(this.video);

          // Filter by threshold
          const filtered = predictions.filter(p => p.score >= this.threshold);

          this._emit('detect', filtered);
          this._emit('inferenceEnd', { predictions: filtered });
        } catch (err) {
          this._emit('error', err);
        }
      }

      this.detecting = false;
    }

    this.rafId = requestAnimationFrame(() => this._loop());
  }

  async detectOnce() {
    if (!this.modelManager.isModelReady() || !this.video) return [];
    const predictions = await this.modelManager.getModel().detect(this.video);
    return predictions.filter(p => p.score >= this.threshold);
  }
}
