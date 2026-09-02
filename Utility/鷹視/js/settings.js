/**
 * SettingsManager — 使用者設定管理
 * 保存與提供使用者設定（in-memory，不使用 localStorage）
 */

export class SettingsManager {
  constructor() {
    this.settings = {
      confidenceThreshold: 0.5,
      targetFPS: 12,
      showConfidence: true,
      showFPS: true,
      showLabels: true,
      speech: false,
      mirrorFrontCamera: true,
      performanceMode: 'medium' // low | medium | high
    };
    this.listeners = [];
  }

  get(key) {
    return this.settings[key];
  }

  getAll() {
    return { ...this.settings };
  }

  set(key, value) {
    const oldValue = this.settings[key];
    this.settings[key] = value;
    this.listeners.forEach(cb => cb(key, value, oldValue));
  }

  onChange(callback) {
    this.listeners.push(callback);
  }

  getPerformanceConfig() {
    const configs = {
      low: { resolution: { width: 640, height: 480 }, targetFPS: 6 },
      medium: { resolution: { width: 1280, height: 720 }, targetFPS: 12 },
      high: { resolution: { width: 1920, height: 1080 }, targetFPS: 15 }
    };
    return configs[this.settings.performanceMode] || configs.medium;
  }
}
