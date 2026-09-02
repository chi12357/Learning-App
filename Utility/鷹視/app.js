/**
 * 鷹視 Hawk Eye — Main App Controller
 * UIController: 管理按鈕、設定與狀態顯示，串接所有模組
 */

import { CameraManager } from './js/camera.js';
import { ModelManager } from './js/model.js';
import { DetectionEngine } from './js/detector.js';
import { OverlayRenderer } from './js/renderer.js';
import { PerformanceMonitor } from './js/performance.js';
import { SettingsManager } from './js/settings.js';
import { SpeechManager } from './js/speech.js';

class App {
  constructor() {
    // DOM elements
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('overlay');
    this.startStopBtn = document.getElementById('startStopBtn');
    this.startStopLabel = document.getElementById('startStopLabel');
    this.soundBtn = document.getElementById('soundBtn');
    this.cameraSwitchBtn = document.getElementById('cameraSwitchBtn');
    this.fullscreenBtn = document.getElementById('fullscreenBtn');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.settingsPanel = document.getElementById('settingsPanel');
    this.backdrop = document.getElementById('backdrop');
    this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.loadingText = document.getElementById('loadingText');
    this.errorOverlay = document.getElementById('errorOverlay');
    this.errorText = document.getElementById('errorText');
    this.retryBtn = document.getElementById('retryBtn');
    this.idleOverlay = document.getElementById('idleOverlay');
    this.statsBar = document.getElementById('statsBar');
    this.statObjects = document.getElementById('statObjects');
    this.statFps = document.getElementById('statFps');
    this.statLatency = document.getElementById('statLatency');
    this.modelInfo = document.getElementById('modelInfo');

    // Settings elements
    this.thresholdSlider = document.getElementById('thresholdSlider');
    this.thresholdValue = document.getElementById('thresholdValue');
    this.targetFpsSlider = document.getElementById('targetFpsSlider');
    this.targetFpsValue = document.getElementById('targetFpsValue');
    this.toggleConfidence = document.getElementById('toggleConfidence');
    this.toggleFps = document.getElementById('toggleFps');
    this.toggleLabels = document.getElementById('toggleLabels');
    this.toggleSpeech = document.getElementById('toggleSpeech');
    this.toggleMirror = document.getElementById('toggleMirror');
    this.perfMode = document.getElementById('perfMode');

    // Modules
    this.camera = new CameraManager();
    this.modelManager = new ModelManager();
    this.detector = new DetectionEngine(this.modelManager);
    this.renderer = new OverlayRenderer(this.canvas, this.video);
    this.performance = new PerformanceMonitor();
    this.settings = new SettingsManager();
    this.speech = new SpeechManager();

    this.isRunning = false;
    this.statsUpdateInterval = null;
    this.resizeObserver = null;

    this.init();
  }

  init() {
    this._setupModules();
    this._bindEvents();
    this._setupResizeObserver();
    this._updateModelInfo();

    // Check HTTPS requirement
    if (window.location.protocol !== 'https:' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1') {
      this._showError('需要使用 HTTPS 才能存取攝影機。請使用 HTTPS 開啟此頁面。');
    }
  }

  _setupModules() {
    this.camera.setVideoElement(this.video);
    this.detector.setVideo(this.video);
    this.renderer.setVideo(this.video);

    // Camera events
    this.camera.on('error', (err) => {
      let msg = '攝影機錯誤';
      if (err.name === 'NotAllowedError') {
        msg = '攝影機權限被拒絕。請允許攝影機存取後重試。';
      } else if (err.name === 'NotFoundError') {
        msg = '找不到可用的攝影機裝置。';
      } else if (err.name === 'NotReadableError') {
        msg = '攝影機被其他應用程式佔用中。';
      }
      this._showError(msg);
    });

    // Detection events
    this.detector.on('detect', (results) => {
      this.renderer.drawDetections(results);
      this.performance.recordFrame();
      this._updateObjectCount(results.length);

      // Speech
      if (this.speech.isEnabled()) {
        this.speech.speakDetections(results);
      }
    });

    this.detector.on('inferenceStart', () => {
      this.performance.beginInference();
    });

    this.detector.on('inferenceEnd', () => {
      this.performance.endInference();
    });

    // Settings change handler
    this.settings.onChange((key, value) => {
      this._applySetting(key, value);
    });
  }

  _bindEvents() {
    // Start/Stop button
    this.startStopBtn.addEventListener('click', () => {
      if (this.isRunning) {
        this._stop();
      } else {
        this._start();
      }
    });

    // Sound button
    this.soundBtn.addEventListener('click', () => {
      const enabled = !this.speech.isEnabled();
      this.speech.setEnabled(enabled);
      this.settings.set('speech', enabled);
      this._updateSoundButton(enabled);
    });

    // Camera switch
    this.cameraSwitchBtn.addEventListener('click', () => {
      this._switchCamera();
    });

    // Fullscreen
    this.fullscreenBtn.addEventListener('click', () => {
      this._toggleFullscreen();
    });

    // Settings
    this.settingsBtn.addEventListener('click', () => this._openSettings());
    this.closeSettingsBtn.addEventListener('click', () => this._closeSettings());
    this.backdrop.addEventListener('click', () => this._closeSettings());

    // Retry
    this.retryBtn.addEventListener('click', () => {
      this._hideError();
      this._start();
    });

    // Settings controls
    this.thresholdSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.thresholdValue.textContent = val.toFixed(2);
      this.settings.set('confidenceThreshold', val);
    });

    this.targetFpsSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.targetFpsValue.textContent = val;
      this.settings.set('targetFPS', val);
    });

    this._bindToggle(this.toggleConfidence, 'showConfidence');
    this._bindToggle(this.toggleFps, 'showFPS');
    this._bindToggle(this.toggleLabels, 'showLabels');
    this._bindToggle(this.toggleSpeech, 'speech');
    this._bindToggle(this.toggleMirror, 'mirrorFrontCamera');

    // Performance mode segmented control
    this.perfMode.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.perfMode.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.set('performanceMode', btn.dataset.mode);
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.startStopBtn.click();
          break;
        case 's':
        case 'S':
          this.soundBtn.click();
          break;
        case 'c':
        case 'C':
          this.cameraSwitchBtn.click();
          break;
        case 'f':
        case 'F':
          this.fullscreenBtn.click();
          break;
        case 'Escape':
          if (this.settingsPanel.classList.contains('open')) {
            this._closeSettings();
          }
          break;
      }
    });

    // Handle fullscreen change
    document.addEventListener('fullscreenchange', () => this._onFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => this._onFullscreenChange());
  }

  _bindToggle(element, settingKey) {
    element.addEventListener('click', () => {
      const current = element.getAttribute('aria-checked') === 'true';
      const newVal = !current;
      element.setAttribute('aria-checked', String(newVal));
      this.settings.set(settingKey, newVal);
    });
  }

  _setupResizeObserver() {
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.camera.isRunning()) {
          this.renderer.syncWithVideo();
        }
      });
      this.resizeObserver.observe(this.video);
    }

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        if (this.camera.isRunning()) {
          this.renderer.syncWithVideo();
        }
      }, 300);
    });

    window.addEventListener('resize', () => {
      if (this.camera.isRunning()) {
        this.renderer.syncWithVideo();
      }
    });
  }

  async _start() {
    this._showLoading('正在啟動攝影機...');

    try {
      // Load model if not ready
      if (!this.modelManager.isModelReady()) {
        this._showLoading('正在載入 AI 模型...');
        await this.modelManager.load((msg) => {
          this.loadingText.textContent = msg;
        });
      }

      // Start camera
      this._showLoading('正在啟動攝影機...');
      await this.camera.start();

      // Sync canvas with video dimensions
      this.renderer.syncWithVideo();

      // Start detection
      await this.detector.start();

      this.isRunning = true;
      this._hideLoading();
      this._hideIdle();
      this._updateStartStopButton();
      this._startStatsUpdate();
      this._updateModelInfo();

    } catch (err) {
      console.error('Start error:', err);
      if (!this.errorOverlay.style.display || this.errorOverlay.style.display === 'none') {
        this._showError(`啟動失敗: ${err.message}`);
      }
    }
  }

  _stop() {
    this.detector.stop();
    this.camera.stop();
    this.renderer.clear();
    this.isRunning = false;
    this._updateStartStopButton();
    this._stopStatsUpdate();
    this._showIdle();
    this.statObjects.textContent = '0';
    this.statFps.textContent = '--';
    this.statLatency.textContent = '--';
    this.speech.cancel();
  }

  async _switchCamera() {
    if (!this.camera.isRunning()) return;

    try {
      const newMode = await this.camera.switchCamera();
      // Update mirror state
      const isFront = newMode === 'user';
      const shouldMirror = isFront && this.settings.get('mirrorFrontCamera');
      this.video.classList.toggle('mirrored', shouldMirror);
      this.renderer.setMirrored(shouldMirror);

      // Sync canvas
      setTimeout(() => this.renderer.syncWithVideo(), 200);
    } catch (err) {
      this._showError(`切換鏡頭失敗: ${err.message}`);
    }
  }

  _toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  _onFullscreenChange() {
    const isFullscreen = !!document.fullscreenElement || !!document.webkitFullscreenElement;
    const iconFs = this.fullscreenBtn.querySelector('.icon-fullscreen');
    const iconExit = this.fullscreenBtn.querySelector('.icon-exit-fullscreen');
    if (iconFs && iconExit) {
      iconFs.style.display = isFullscreen ? 'none' : 'block';
      iconExit.style.display = isFullscreen ? 'block' : 'none';
    }
    this.fullscreenBtn.classList.toggle('active', isFullscreen);
    setTimeout(() => {
      if (this.camera.isRunning()) this.renderer.syncWithVideo();
    }, 300);
  }

  _openSettings() {
    this.settingsPanel.classList.add('open');
    this.backdrop.classList.add('visible');
  }

  _closeSettings() {
    this.settingsPanel.classList.remove('open');
    this.backdrop.classList.remove('visible');
  }

  _applySetting(key, value) {
    switch (key) {
      case 'confidenceThreshold':
        this.detector.setThreshold(value);
        break;
      case 'targetFPS':
        this.detector.setTargetFPS(value);
        break;
      case 'showConfidence':
        this.renderer.setShowConfidence(value);
        break;
      case 'showFPS':
        this.renderer.setShowFps(value);
        this.statsBar.style.display = value ? '' : 'none';
        break;
      case 'showLabels':
        this.renderer.setShowLabels(value);
        break;
      case 'speech':
        this.speech.setEnabled(value);
        this._updateSoundButton(value);
        if (this.toggleSpeech.getAttribute('aria-checked') !== String(value)) {
          this.toggleSpeech.setAttribute('aria-checked', String(value));
        }
        break;
      case 'mirrorFrontCamera':
        this.renderer.setMirrored(value && this.camera.getFacingMode() === 'user');
        this.video.classList.toggle('mirrored',
          value && this.camera.getFacingMode() === 'user');
        break;
      case 'performanceMode':
        const config = this.settings.getPerformanceConfig();
        this.settings.set('targetFPS', config.targetFPS);
        this.targetFpsSlider.value = config.targetFPS;
        this.targetFpsValue.textContent = config.targetFPS;
        this.detector.setTargetFPS(config.targetFPS);
        break;
    }
  }

  _startStatsUpdate() {
    if (this.statsUpdateInterval) clearInterval(this.statsUpdateInterval);
    this.statsUpdateInterval = setInterval(() => {
      const fps = this.performance.getFPS();
      const latency = this.performance.getLatency();
      this.statFps.textContent = fps > 0 ? fps : '--';
      this.statLatency.textContent = latency > 0 ? latency + 'ms' : '--';
    }, 500);
  }

  _stopStatsUpdate() {
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
    }
  }

  _updateObjectCount(count) {
    this.statObjects.textContent = count;
  }

  _updateStartStopButton() {
    const iconPlay = this.startStopBtn.querySelector('.icon-play');
    const iconStop = this.startStopBtn.querySelector('.icon-stop');
    if (this.isRunning) {
      iconPlay.style.display = 'none';
      iconStop.style.display = 'block';
      this.startStopBtn.classList.add('recording');
      this.startStopLabel.textContent = '停止';
    } else {
      iconPlay.style.display = 'block';
      iconStop.style.display = 'none';
      this.startStopBtn.classList.remove('recording');
      this.startStopLabel.textContent = '開始';
    }
  }

  _updateSoundButton(enabled) {
    const iconOn = this.soundBtn.querySelector('.icon-sound-on');
    const iconOff = this.soundBtn.querySelector('.icon-sound-off');
    if (iconOn && iconOff) {
      iconOn.style.display = enabled ? 'block' : 'none';
      iconOff.style.display = enabled ? 'none' : 'block';
    }
    this.soundBtn.classList.toggle('active', enabled);
    if (this.toggleSpeech.getAttribute('aria-checked') !== String(enabled)) {
      this.toggleSpeech.setAttribute('aria-checked', String(enabled));
    }
  }

  _updateModelInfo() {
    const info = this.modelManager.getModelInfo();
    this.modelInfo.textContent = `模型: ${info.name} · ${info.classes} 類別 · Backend: ${info.backend || 'webgl'}`;
  }

  _showLoading(msg) {
    this.loadingText.textContent = msg || '載入中...';
    this.loadingOverlay.style.display = 'flex';
    this._hideIdle();
    this._hideError();
  }

  _hideLoading() {
    this.loadingOverlay.style.display = 'none';
  }

  _showError(msg) {
    this.errorText.textContent = msg;
    this.errorOverlay.style.display = 'flex';
    this._hideLoading();
    this._hideIdle();
  }

  _hideError() {
    this.errorOverlay.style.display = 'none';
  }

  _showIdle() {
    this.idleOverlay.style.display = 'flex';
    this.statsBar.classList.add('hidden');
  }

  _hideIdle() {
    this.idleOverlay.style.display = 'none';
    if (this.settings.get('showFPS')) {
      this.statsBar.classList.remove('hidden');
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new App());
} else {
  new App();
}
