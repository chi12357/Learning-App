/**
 * ModelManager — AI 模型管理
 * 負責載入、初始化與管理 TensorFlow.js Object Detection Model
 */

export class ModelManager {
  constructor() {
    this.model = null;
    this.isReady = false;
    this.isLoading = false;
    this.modelName = 'COCO-SSD';
    this.backend = '';
  }

  async load(progressCallback) {
    if (this.isReady) return this.model;
    if (this.isLoading) {
      // Wait for existing load
      while (this.isLoading) {
        await new Promise(r => setTimeout(r, 100));
      }
      return this.model;
    }

    this.isLoading = true;

    try {
      if (progressCallback) progressCallback('正在初始化 TensorFlow.js...');

      // Set backend — prefer webgl, fall back to cpu
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        this.backend = tf.getBackend();
      } catch {
        console.warn('WebGL backend unavailable, trying CPU');
        await tf.setBackend('cpu');
        await tf.ready();
        this.backend = tf.getBackend();
      }

      if (progressCallback) progressCallback('正在載入 COCO-SSD 模型...');

      // Load COCO-SSD model
      this.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      this.isReady = true;
      this.isLoading = false;

      if (progressCallback) progressCallback('模型載入完成');

      return this.model;
    } catch (err) {
      this.isLoading = false;
      this.isReady = false;
      throw new Error(`模型載入失敗: ${err.message}`);
    }
  }

  getModel() {
    return this.model;
  }

  isModelReady() {
    return this.isReady;
  }

  getModelInfo() {
    return {
      name: this.modelName,
      backend: this.backend,
      classes: 80
    };
  }
}
