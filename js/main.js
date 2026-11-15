// =============================================================================
// PONTO DE ENTRADA DA APLICAÇÃO (ES MODULE BOOTSTRAP)
// =============================================================================

import { audio } from './audio.js';
import { initCanvasPolyfills, dom } from './dom.js';
import { resizeCanvas, gameLoop } from './gameplay.js';
import { initInputListeners } from './input.js';
import { renderSkinPreviews } from './render/player.js';
import { state, initClouds, initNightStars } from './state.js';
import { loadSettings, loadProgressState } from './storage.js';
import { syncTouchModeUI, syncProgressUI } from './ui.js';
import { initMultiplayerFromUrl } from './multiplayer.js';

function bootstrapApp() {
  initCanvasPolyfills();
  loadSettings();
  audio.setMusicEnabled(state.musicEnabled);
  if (state.mutedPreference) {
    audio.setMuted(true);
  }
  loadProgressState();
  syncTouchModeUI();
  syncProgressUI();

  if (dom.startHighScore) {
    dom.startHighScore.textContent = `${state.highScore.toLocaleString('pt-BR')} pts`;
  }

  initClouds();
  initNightStars();
  initInputListeners();
  initMultiplayerFromUrl();

  const startLoop = () => {
    resizeCanvas();
    renderSkinPreviews();
    audio.setMusicEnabled(state.musicEnabled);
    setTimeout(() => audio.ensureBgmLoaded(), 60);
    requestAnimationFrame(gameLoop);
  };

  if (document.readyState === 'complete') {
    startLoop();
  } else {
    window.addEventListener('load', startLoop);
  }
}

bootstrapApp();
