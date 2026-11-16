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
import { loadMonetizationState, syncDailyBonusBadge } from './monetization.js';

function bootstrapApp() {
  initCanvasPolyfills();
  loadSettings();
  audio.setMusicEnabled(state.musicEnabled);
  if (state.mutedPreference) {
    audio.setMuted(true);
  }
  loadProgressState();
  loadMonetizationState();
  syncDailyBonusBadge();
  syncTouchModeUI();
  syncProgressUI();

  if (dom.startHighScore) {
    dom.startHighScore.textContent = `${state.highScore.toLocaleString('pt-BR')} pts`;
  }

  initClouds();
  initNightStars();
  initInputListeners();
  initMultiplayerFromUrl();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const hadController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;

      const showUpdateScreen = (text, percent) => {
        if (state.gameState !== 'START') return;
        if (dom.pwaUpdateOverlay) dom.pwaUpdateOverlay.classList.remove('hidden');
        if (dom.pwaUpdateText && text) dom.pwaUpdateText.textContent = text;
        if (dom.pwaUpdateBar && typeof percent === 'number') {
          dom.pwaUpdateBar.style.width = `${percent}%`;
        }
      };

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || refreshing) return;
        if (state.gameState !== 'START') return;
        try {
          if (sessionStorage.getItem('op24h_sw_reloaded') === '1') return;
          sessionStorage.setItem('op24h_sw_reloaded', '1');
        } catch (e) {}
        refreshing = true;
        showUpdateScreen('Aplicando atualização! Reiniciando...', 100);
        setTimeout(() => window.location.reload(), 350);
      });

      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
        try { sessionStorage.removeItem('op24h_sw_reloaded'); } catch (e) {}
        reg.update().catch(() => {});

        if (reg.waiting && hadController) {
          showUpdateScreen('Instalando versão mais recente...', 80);
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const nextWorker = reg.installing;
          if (!nextWorker) return;
          if (hadController) {
            showUpdateScreen('Baixando nova atualização...', 45);
          }
          nextWorker.addEventListener('statechange', () => {
            if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateScreen('Instalando versão mais recente...', 85);
              nextWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        document.addEventListener('visibilitychange', () => {
          if (!document.hidden && state.gameState === 'START') {
            reg.update().catch(() => {});
          }
        });
      }).catch(() => {});
    });
  }

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
