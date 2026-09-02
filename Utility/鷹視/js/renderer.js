/**
 * OverlayRenderer — Canvas 疊加層渲染
 * 將 Bounding Box、物體名稱與信心度繪製到 Canvas
 */

export class OverlayRenderer {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.video = video;
    this.dpr = window.devicePixelRatio || 1;
    this.showConfidence = true;
    this.showLabels = true;
    this.showFps = true;
    this.mirrored = false;
  }

  setVideo(video) {
    this.video = video;
  }

  resize(width, height) {
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.scale(this.dpr, this.dpr);
  }

  syncWithVideo() {
    if (!this.video || this.video.videoWidth === 0) return;
    const rect = this.video.getBoundingClientRect();
    this.resize(rect.width, rect.height);
  }

  setShowConfidence(show) {
    this.showConfidence = show;
  }

  setShowLabels(show) {
    this.showLabels = show;
  }

  setShowFps(show) {
    this.showFps = show;
  }

  setMirrored(mirrored) {
    this.mirrored = mirrored;
  }

  clear() {
    const rect = this.video ? this.video.getBoundingClientRect() : this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
  }

  drawDetections(results) {
    this.clear();
    if (!results || results.length === 0) return;

    const videoRect = this.video.getBoundingClientRect();
    const videoWidth = this.video.videoWidth;
    const videoHeight = this.video.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) return;

    // Calculate object-fit: cover scaling
    const containerRatio = videoRect.width / videoRect.height;
    const videoRatio = videoWidth / videoHeight;

    let scaleX, scaleY, offsetX = 0, offsetY = 0;

    if (videoRatio > containerRatio) {
      // Video is wider than container — crop horizontally
      scaleX = videoRect.width / videoWidth;
      scaleY = videoRect.height / videoHeight;
      // object-fit: cover means we scale to cover, then crop
      const scale = Math.max(videoRect.width / videoWidth, videoRect.height / videoHeight);
      scaleX = scale;
      scaleY = scale;
      offsetX = (videoRect.width - videoWidth * scale) / 2;
      offsetY = (videoRect.height - videoHeight * scale) / 2;
    } else {
      const scale = Math.max(videoRect.width / videoWidth, videoRect.height / videoHeight);
      scaleX = scale;
      scaleY = scale;
      offsetX = (videoRect.width - videoWidth * scale) / 2;
      offsetY = (videoRect.height - videoHeight * scale) / 2;
    }

    // Color palette for different detection classes
    const colors = this._getColorPalette();

    results.forEach((det, i) => {
      const [x, y, w, h] = det.bbox;
      let drawX = x * scaleX + offsetX;
      let drawY = y * scaleY + offsetY;
      let drawW = w * scaleX;
      let drawH = h * scaleY;

      // Mirror if front camera
      if (this.mirrored) {
        drawX = videoRect.width - drawX - drawW;
      }

      const color = colors[i % colors.length];
      const confidence = Math.round(det.score * 100);
      const label = this._formatLabel(det.class, confidence);

      // Draw bounding box
      this.ctx.lineWidth = 2.5;
      this.ctx.strokeStyle = color;
      this.ctx.beginPath();
      // Rounded rectangle
      const r = Math.min(6, drawW / 4, drawH / 4);
      this._roundRect(drawX, drawY, drawW, drawH, r);
      this.ctx.stroke();

      // Draw semi-transparent fill
      this.ctx.fillStyle = color + '15';
      this._roundRect(drawX, drawY, drawW, drawH, r);
      this.ctx.fill();

      // Draw label background
      if (this.showLabels) {
        const labelText = this.showConfidence ? `${det.class} ${confidence}%` : det.class;
        this.ctx.font = '600 13px "Inter", sans-serif';
        const metrics = this.ctx.measureText(labelText);
        const labelW = metrics.width + 16;
        const labelH = 22;
        let labelX = drawX;
        let labelY = drawY - labelH;

        // Keep label inside canvas
        if (labelY < 0) labelY = drawY + 4;
        if (labelX + labelW > videoRect.width) labelX = videoRect.width - labelW;
        if (labelX < 0) labelX = 0;

        // Label background
        this.ctx.fillStyle = color;
        this._roundRect(labelX, labelY, labelW, labelH, 4);
        this.ctx.fill();

        // Label text
        this.ctx.fillStyle = '#0a0e0a';
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(labelText, labelX + 8, labelY + labelH / 2);
      }

      // Corner accents for style
      this._drawCorners(drawX, drawY, drawW, drawH, color);
    });
  }

  _drawCorners(x, y, w, h, color) {
    const len = Math.min(16, w / 3, h / 3);
    const lw = 3;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lw;
    this.ctx.lineCap = 'round';

    // Top-left
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + len);
    this.ctx.lineTo(x, y);
    this.ctx.lineTo(x + len, y);
    this.ctx.stroke();

    // Top-right
    this.ctx.beginPath();
    this.ctx.moveTo(x + w - len, y);
    this.ctx.lineTo(x + w, y);
    this.ctx.lineTo(x + w, y + len);
    this.ctx.stroke();

    // Bottom-left
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + h - len);
    this.ctx.lineTo(x, y + h);
    this.ctx.lineTo(x + len, y + h);
    this.ctx.stroke();

    // Bottom-right
    this.ctx.beginPath();
    this.ctx.moveTo(x + w - len, y + h);
    this.ctx.lineTo(x + w, y + h);
    this.ctx.lineTo(x + w, y + h - len);
    this.ctx.stroke();
  }

  _roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, r);
    this.ctx.arcTo(x + w, y + h, x, y + h, r);
    this.ctx.arcTo(x, y + h, x, y, r);
    this.ctx.arcTo(x, y, x + w, y, r);
    this.ctx.closePath();
  }

  _formatLabel(className, confidence) {
    // Translate common class names to Chinese
    const translations = {
      'person': '人',
      'car': '車',
      'truck': '卡車',
      'bus': '公車',
      'bicycle': '自行車',
      'motorcycle': '機車',
      'dog': '狗',
      'cat': '貓',
      'bird': '鳥',
      'horse': '馬',
      'cow': '牛',
      'sheep': '羊',
      'bottle': '瓶子',
      'cup': '杯子',
      'wine glass': '酒杯',
      'bowl': '碗',
      'banana': '香蕉',
      'apple': '蘋果',
      'orange': '橘子',
      'sandwich': '三明治',
      'cake': '蛋糕',
      'chair': '椅子',
      'couch': '沙發',
      'bed': '床',
      'dining table': '餐桌',
      'toilet': '馬桶',
      'tv': '電視',
      'laptop': '筆電',
      'mouse': '滑鼠',
      'keyboard': '鍵盤',
      'cell phone': '手機',
      'remote': '遙控器',
      'clock': '時鐘',
      'vase': '花瓶',
      'scissors': '剪刀',
      'teddy bear': '泰迪熊',
      'hair drier': '吹風機',
      'toothbrush': '牙刷',
      'book': '書',
      'backpack': '背包',
      'handbag': '手提包',
      'suitcase': '行李箱',
      'umbrella': '雨傘',
      'tie': '領帶',
      'skis': '滑雪板',
      'snowboard': '單板滑雪板',
      'sports ball': '球',
      'kite': '風箏',
      'baseball bat': '球棒',
      'baseball glove': '棒球手套',
      'skateboard': '滑板',
      'surfboard': '衝浪板',
      'tennis racket': '網球拍',
      'fork': '叉子',
      'knife': '刀',
      'spoon': '湯匙',
      'potted plant': '盆栽',
      'oven': '烤箱',
      'microwave': '微波爐',
      'toaster': '烤麵包機',
      'refrigerator': '冰箱',
      'sink': '水槽',
      'fire hydrant': '消防栓',
      'stop sign': '停止標誌',
      'parking meter': '停車計時器',
      'bench': '長椅',
      'traffic light': '紅綠燈',
      'fountain': '噴泉',
      'airplane': '飛機',
      'train': '火車',
      'boat': '船',
      'broccoli': '花椰菜',
      'carrot': '胡蘿蔔',
      'hot dog': '熱狗',
      'pizza': '披薩',
      'donut': '甜甜圈',
      'frisbee': '飛盤'
    };
    const zh = translations[className] || className;
    return `${zh} ${confidence}%`;
  }

  _getColorPalette() {
    return [
      '#00e676', // green
      '#ffd60a', // gold
      '#00b0ff', // blue
      '#ff6b35', // orange
      '#e91e63', // pink
      '#00bcd4', // cyan
      '#ff5722', // deep orange
      '#8bc34a', // light green
      '#ffc107', // amber
      '#03a9f4', // light blue
    ];
  }
}
