/**
 * CameraManager — 攝影機管理
 * 負責開啟、停止、切換攝影機與處理權限
 */

export class CameraManager {
  constructor() {
    this.video = null;
    this.stream = null;
    this.facingMode = 'environment';
    this.state = 'IDLE'; // IDLE | REQUESTING | RUNNING | PAUSED | ERROR | STOPPED
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

  getVideoElement() {
    return this.video;
  }

  setVideoElement(video) {
    this.video = video;
  }

  getState() {
    return this.state;
  }

  async start(facingMode = null) {
    if (facingMode) this.facingMode = facingMode;

    if (!this.video) {
      throw new Error('Video element not set');
    }

    this.state = 'REQUESTING';
    this._emit('stateChange', this.state);

    try {
      // Stop existing stream
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
      }

      const constraints = {
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;

      // Wait for video to be ready
      await new Promise((resolve) => {
        if (this.video.readyState >= 2) {
          resolve();
        } else {
          this.video.addEventListener('loadeddata', resolve, { once: true });
        }
      });

      await this.video.play().catch(() => {});

      this.state = 'RUNNING';
      this._emit('stateChange', this.state);
      this._emit('started', {
        width: this.video.videoWidth,
        height: this.video.videoHeight
      });

      return { width: this.video.videoWidth, height: this.video.videoHeight };
    } catch (err) {
      this.state = 'ERROR';
      this._emit('stateChange', this.state);
      this._emit('error', err);
      throw err;
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.state = 'STOPPED';
    this._emit('stateChange', this.state);
    this._emit('stopped');
  }

  async switchCamera() {
    const newMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.facingMode = newMode;
    await this.start(newMode);
    return newMode;
  }

  getFacingMode() {
    return this.facingMode;
  }

  isRunning() {
    return this.state === 'RUNNING';
  }

  async hasMultipleCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      return videoDevices.length > 1;
    } catch {
      return false;
    }
  }
}
