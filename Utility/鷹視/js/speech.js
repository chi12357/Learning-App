/**
 * SpeechManager — 語音管理
 * 使用 Web Speech API 進行語音提示，包含去重與冷卻時間
 */

export class SpeechManager {
  constructor() {
    this.enabled = false;
    this.lastSpoken = new Map(); // class -> timestamp
    this.cooldownMs = 5000; // 5 seconds between repeating same class
    this.synth = window.speechSynthesis || null;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && this.synth) {
      this.synth.cancel();
    }
  }

  isEnabled() {
    return this.enabled;
  }

  speakDetections(detections) {
    if (!this.enabled || !this.synth || detections.length === 0) return;

    const now = Date.now();
    const toSpeak = [];

    detections.forEach(det => {
      const lastTime = this.lastSpoken.get(det.class) || 0;
      if (now - lastTime > this.cooldownMs) {
        toSpeak.push(det.class);
        this.lastSpoken.set(det.class, now);
      }
    });

    if (toSpeak.length === 0) return;

    // Build speech text in Chinese
    const translations = {
      'person': '人', 'car': '車', 'truck': '卡車', 'bus': '公車',
      'bicycle': '自行車', 'motorcycle': '機車', 'dog': '狗', 'cat': '貓',
      'bird': '鳥', 'bottle': '瓶子', 'cup': '杯子', 'chair': '椅子',
      'laptop': '筆電', 'cell phone': '手機', 'book': '書', 'clock': '時鐘',
      'keyboard': '鍵盤', 'mouse': '滑鼠', 'tv': '電視', 'couch': '沙發',
      'bed': '床', 'dining table': '餐桌', 'potted plant': '盆栽',
      'refrigerator': '冰箱', 'microwave': '微波爐', 'oven': '烤箱'
    };

    const items = toSpeak.map(cls => translations[cls] || cls);
    const text = `偵測到 ${items.join('、')}`;

    // Cancel any ongoing speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 1.1;
    utterance.volume = 0.8;

    this.synth.speak(utterance);
  }

  cancel() {
    if (this.synth) this.synth.cancel();
  }

  reset() {
    this.lastSpoken.clear();
  }
}
