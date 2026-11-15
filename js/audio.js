// =============================================================================
// MOTOR DE ÁUDIO (TRILHA MP3 ./assets/bgm.mp3 + SFX WEB AUDIO API)
// =============================================================================

import { dom } from './dom.js';
import { state } from './state.js';

export class ChaseAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
    this.initialized = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.isMusicRunning = false;
    this.currentMusicAct = 1;

    // Trilha sonora de fundo externa (./assets/bgm.mp3)
    this.musicEnabled = typeof state.musicEnabled === 'boolean' ? state.musicEnabled : true;
    this.bgmAudio = dom.bgmAudio || document.getElementById('bgmAudio');
    this.bgmReady = false;
    this.bgmFailed = false;
    this.bgmWanted = false;
    this.bgmVolume = 0.34;

    if (this.bgmAudio) {
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = this.bgmVolume;
      this.bgmAudio.addEventListener('error', () => {
        this.bgmFailed = true;
        if (this.isMusicRunning && this.musicEnabled && !this.musicTimer) {
          this._startProceduralLoop();
        }
      });
    }
    this._syncPauseMusicUi();
  }

  ensureBgmLoaded() {
    if (this.bgmReady || this.bgmFailed || !this.bgmAudio) return this.bgmReady;
    try {
      if (!this.bgmAudio.getAttribute('src')) {
        this.bgmAudio.src = './assets/bgm.mp3';
      }
      this.bgmAudio.volume = this.bgmVolume;
      this.bgmAudio.muted = this.muted;
      this.bgmReady = true;
      return true;
    } catch (e) {
      this.bgmFailed = true;
      return false;
    }
  }

  _syncPauseMusicUi() {
    if (dom.btnPauseMusicText) {
      dom.btnPauseMusicText.textContent = this.musicEnabled
        ? '🎵 Música de Fundo: Ligada'
        : '🔇 Música de Fundo: Desligada';
    }
    if (dom.btnPauseMusic) {
      dom.btnPauseMusic.classList.toggle('opacity-75', !this.musicEnabled);
    }
    if (dom.btnStartMusicText) {
      dom.btnStartMusicText.textContent = this.musicEnabled ? '🎵 Música: Ligada' : '🔇 Música: Desligada';
    }
    if (dom.btnStartMusic) {
      dom.btnStartMusic.classList.toggle('opacity-75', !this.musicEnabled);
    }
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = Boolean(enabled);
    this._syncPauseMusicUi();
    if (!this.musicEnabled) {
      this.pauseBgm(false);
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    } else if (state.gameState === 'PLAYING' && !state.isPaused) {
      this.playBgm(false);
      if (this.bgmFailed && this.isMusicRunning && !this.musicTimer) {
        this._startProceduralLoop();
      }
    }
  }

  playBgm(resetTime = false) {
    this.bgmWanted = true;
    if (!this.musicEnabled || !this.bgmAudio) return;
    if (!this.bgmReady && !this.bgmFailed) {
      this.ensureBgmLoaded();
    }
    if (this.bgmFailed) return;
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = this.bgmVolume;
    this.bgmAudio.muted = this.muted;
    if (resetTime) {
      try {
        if (this.bgmAudio.readyState > 0) this.bgmAudio.currentTime = 0;
      } catch (e) {}
    }
    if (this.muted) return;
    try {
      const playPromise = this.bgmAudio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } catch (e) {}
  }

  pauseBgm(keepWanted = false) {
    if (!keepWanted) {
      this.bgmWanted = false;
    }
    if (this.bgmAudio && !this.bgmAudio.paused) {
      try {
        this.bgmAudio.pause();
      } catch (e) {}
    }
  }

  stopBgm(resetTime = true) {
    this.bgmWanted = false;
    if (this.bgmAudio) {
      try {
        if (!this.bgmAudio.paused) {
          this.bgmAudio.pause();
        }
        if (resetTime && this.bgmAudio.readyState > 0) {
          this.bgmAudio.currentTime = 0;
        }
      } catch (e) {}
    }
  }

  init() {
    this.ensureBgmLoaded();
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.bgmWanted && this.musicEnabled && !this.muted && state.gameState === 'PLAYING' && !state.isPaused) {
        this.playBgm(false);
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0.0001 : 1.15;
      this.masterGain.connect(this.ctx.destination);

      // Som contínuo sutil de motor (carro no Ato 2 / hélice no Ato 3)
      this.engineOsc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      this.engineGain.gain.value = 0.0001;

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();

      this.initialized = true;
    } catch (e) {}
  }

  setMuted(mute) {
    this.muted = mute;
    if (this.initialized && this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.muted ? 0.0001 : 1.15, now, 0.02);
    }
    if (this.bgmAudio) {
      this.bgmAudio.muted = this.muted;
    }
    if (!this.muted && this.bgmWanted && this.musicEnabled && state.gameState === 'PLAYING' && !state.isPaused) {
      this.playBgm(false);
    }
    dom.iconAudioOn.classList.toggle('hidden', this.muted);
    dom.iconAudioOff.classList.toggle('hidden', !this.muted);
  }

  updateVehicleHum(isPlaying, act, isBoosting) {
    if (!this.initialized || !this.ctx || !this.engineOsc || !this.engineGain) return;
    const now = this.ctx.currentTime;
    if (!isPlaying || this.muted || act === 1) {
      this.engineGain.gain.setTargetAtTime(0.0001, now, 0.06);
      return;
    }
    if (act === 2) {
      // Ronco grave do sedã executivo
      this.engineOsc.frequency.setTargetAtTime(isBoosting ? 105 : 74, now, 0.07);
      this.engineGain.gain.setTargetAtTime(isBoosting ? 0.028 : 0.018, now, 0.07);
    } else {
      // Hélice / turbina do avião
      this.engineOsc.frequency.setTargetAtTime(isBoosting ? 128 : 88, now, 0.07);
      this.engineGain.gain.setTargetAtTime(isBoosting ? 0.032 : 0.02, now, 0.07);
    }
  }

  _startProceduralLoop() {
    if (this.musicTimer) return;
    this.musicStep = 0;

    // Padrões melódicos adaptativos para os 3 atos (fallback se MP3 falhar)
    const act1Lead = [392.00, 0, 440.00, 493.88, 523.25, 493.88, 440.00, 392.00, 329.63, 0, 392.00, 440.00, 392.00, 0, 349.23, 0];
    const act2Lead = [293.66, 293.66, 440.00, 0, 392.00, 349.23, 329.63, 293.66, 261.63, 261.63, 392.00, 0, 349.23, 329.63, 293.66, 0];
    const act3Lead = [523.25, 0, 659.25, 783.99, 698.46, 0, 587.33, 523.25, 440.00, 0, 523.25, 659.25, 587.33, 0, 523.25, 0];
    const bassLine = [146.83, 0, 146.83, 0, 174.61, 0, 196.00, 0, 130.81, 0, 130.81, 0, 164.81, 0, 196.00, 0];

    this.musicTimer = setInterval(() => {
      if (!this.isMusicRunning || !this.musicEnabled || this.muted || !this.initialized || !this.ctx || state.isPaused || document.hidden) return;
      const idx = this.musicStep % 16;
      this.musicStep++;

      const leadArr = this.currentMusicAct === 1 ? act1Lead : this.currentMusicAct === 2 ? act2Lead : act3Lead;
      const lead = leadArr[idx];
      const bass = bassLine[idx];

      if (lead > 0) {
        const wave = this.currentMusicAct === 2 ? 'sawtooth' : 'triangle';
        const vol = this.currentMusicAct === 2 ? 0.025 : 0.036;
        this.playTone(lead, lead * 1.008, 0.12, wave, vol);
      }
      if (bass > 0) {
        this.playTone(bass, bass * 0.96, 0.14, 'sine', 0.048);
      }
    }, 195);
  }

  startMusic(act = 1) {
    this.init();
    this.currentMusicAct = act;
    this.isMusicRunning = true;
    this.playBgm(true);
    if (this.bgmFailed && this.musicEnabled) {
      this._startProceduralLoop();
    }
  }

  setMusicAct(act) {
    this.currentMusicAct = act;
  }

  stopMusic() {
    this.isMusicRunning = false;
    this.stopBgm(true);
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.updateVehicleHum(false, 1, false);
  }

  playTone(startFreq, endFreq, duration, wave = 'sine', volume = 0.12, delay = 0) {
    if (this.muted || !this.initialized || !this.ctx || !this.masterGain) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(Math.max(20, startFreq), t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);

      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t0);
      osc.stop(t0 + duration + 0.01);
    } catch (e) {}
  }

  playJump(isDouble = false) {
    if (isDouble) {
      this.playTone(420, 760, 0.14, 'triangle', 0.13, 0);
    } else {
      this.playTone(260, 520, 0.13, 'triangle', 0.12, 0);
    }
  }

  playSlide() {
    this.playTone(280, 110, 0.14, 'triangle', 0.10, 0);
  }

  playCarHop() {
    this.playTone(150, 340, 0.16, 'sawtooth', 0.09, 0);
    this.playTone(320, 480, 0.12, 'triangle', 0.08, 0.03);
  }

  playNearMiss() {
    this.playTone(540, 960, 0.11, 'sine', 0.11, 0);
    this.playTone(960, 1280, 0.09, 'triangle', 0.09, 0.05);
  }

  playStarPickup() {
    this.playTone(659.25, 987.77, 0.10, 'triangle', 0.12, 0);
    this.playTone(987.77, 1318.51, 0.14, 'triangle', 0.11, 0.05);
  }

  playRingPickup() {
    this.playTone(523.25, 783.99, 0.10, 'sine', 0.12, 0);
    this.playTone(783.99, 1046.50, 0.16, 'triangle', 0.13, 0.06);
  }

  playCoffeeFreeze() {
    this.playTone(783.99, 1046.50, 0.11, 'sine', 0.14, 0);
    this.playTone(1046.50, 1567.98, 0.18, 'sine', 0.14, 0.07);
  }

  playPowerupActivate() {
    this.playTone(440.00, 587.33, 0.10, 'triangle', 0.13, 0);
    this.playTone(587.33, 880.00, 0.17, 'triangle', 0.14, 0.07);
  }

  playRampLaunch() {
    this.playTone(190, 620, 0.19, 'sawtooth', 0.11, 0);
    this.playTone(520, 940, 0.14, 'triangle', 0.12, 0.04);
  }

  playWindGust() {
    this.playTone(480, 920, 0.15, 'sine', 0.10, 0);
    this.playTone(680, 1180, 0.18, 'triangle', 0.11, 0.06);
  }

  playMilestoneChime() {
    this.playTone(659.25, 659.25, 0.09, 'triangle', 0.12, 0);
    this.playTone(880.00, 1046.50, 0.18, 'triangle', 0.14, 0.08);
  }

  playCarBoardTransition() {
    // Batida de porta + aceleração do sedã
    this.playTone(140, 55, 0.11, 'square', 0.16, 0);
    this.playTone(110, 290, 0.34, 'sawtooth', 0.12, 0.12);
    this.playTone(523.25, 783.99, 0.22, 'triangle', 0.13, 0.24);
  }

  playTakeoffTransition() {
    // Turbina de decolagem + fanfarra de vitória das 24h
    this.playTone(130, 540, 0.55, 'sawtooth', 0.11, 0);
    this.playTone(523.25, 659.25, 0.14, 'triangle', 0.14, 0.15);
    this.playTone(659.25, 783.99, 0.14, 'triangle', 0.14, 0.28);
    this.playTone(783.99, 1046.50, 0.32, 'triangle', 0.16, 0.42);
  }

  playWarningBeep() {
    this.playTone(920, 920, 0.06, 'square', 0.05, 0);
    this.playTone(1180, 1180, 0.07, 'square', 0.05, 0.09);
  }

  playShieldBreak() {
    this.playTone(520, 130, 0.22, 'sawtooth', 0.14, 0);
    this.playTone(260, 90, 0.20, 'triangle', 0.12, 0.04);
  }

  playSirenTimeout() {
    this.stopMusic();
    this.playTone(680, 920, 0.25, 'sawtooth', 0.14, 0);
    this.playTone(920, 680, 0.25, 'sawtooth', 0.14, 0.25);
    this.playTone(680, 920, 0.25, 'sawtooth', 0.14, 0.50);
    this.playTone(920, 680, 0.30, 'sawtooth', 0.14, 0.75);
  }

  playComicCrash() {
    this.stopMusic();
    // Pancada cômica de impacto + Sad Trombone (wah-wah-wah-waaaah)
    this.playTone(170, 52, 0.19, 'triangle', 0.20, 0);
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const baseT = this.ctx.currentTime;
    const notes = [
      { freq: 293.66, endFreq: 277.18, start: 0.14, dur: 0.24, wah: 580 }, // Ré4 (wah)
      { freq: 277.18, endFreq: 261.63, start: 0.40, dur: 0.24, wah: 540 }, // Dó#4 (wah)
      { freq: 261.63, endFreq: 246.94, start: 0.66, dur: 0.24, wah: 500 }, // Dó4 (wah)
      { freq: 246.94, endFreq: 164.81, start: 0.92, dur: 0.78, wah: 460, isFinal: true } // Si3 -> Mi3 (waaaah)
    ];
    for (const n of notes) {
      try {
        const t0 = baseT + n.start;
        const osc = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        subOsc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, t0);
        osc.frequency.exponentialRampToValueAtTime(n.endFreq, t0 + n.dur);
        subOsc.frequency.setValueAtTime(n.freq * 0.5, t0);
        subOsc.frequency.exponentialRampToValueAtTime(n.endFreq * 0.5, t0 + n.dur);

        filter.type = 'lowpass';
        filter.Q.value = n.isFinal ? 4.2 : 3.2;
        filter.frequency.setValueAtTime(n.wah * 0.45, t0);
        filter.frequency.exponentialRampToValueAtTime(n.wah * 1.45, t0 + 0.09);
        filter.frequency.exponentialRampToValueAtTime(190, t0 + n.dur);

        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(0.16, t0 + 0.035);
        if (n.isFinal) {
          gain.gain.setValueAtTime(0.15, t0 + n.dur * 0.45);
        }
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);

        osc.connect(filter);
        subOsc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t0);
        subOsc.start(t0);
        osc.stop(t0 + n.dur + 0.02);
        subOsc.stop(t0 + n.dur + 0.02);
      } catch (e) {}
    }
  }
}

export const audio = new ChaseAudioEngine();
