// =============================================================================
// CONTROLES (TECLADO, TOQUE, MOUSE, BOTÕES E FULLSCREEN)
// =============================================================================

import { audio } from './audio.js';
import { dom, canvas } from './dom.js';
import { resizeCanvas, render, syncTouchZoneGuides, handleDuckOrFastFall, pulseTouchPill, handleActionPress, handleActionRelease, togglePause, startGame, returnToMenu } from './gameplay.js';
import { state } from './state.js';
import { closeGarage, toggleMutePreference, cycleRoast, generateAndDownloadShareCard, toggleMusicPreference, toggleTouchModePreference, openGarage } from './ui.js';

export function initInputListeners() {
  dom.btnModeCampaign.addEventListener('click', () => {
    state.selectedGameMode = 'campaign';
    dom.btnModeCampaign.className = 'rounded-xl py-2 px-2.5 sm:px-3 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider transition cursor-pointer bg-sky-500 text-white shadow';
    dom.btnModeClassic.className = 'rounded-xl py-2 px-2.5 sm:px-3 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider transition cursor-pointer text-slate-300 hover:text-white';
  });

  dom.btnModeClassic.addEventListener('click', () => {
    state.selectedGameMode = 'classic';
    dom.btnModeClassic.className = 'rounded-xl py-2 px-2.5 sm:px-3 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider transition cursor-pointer bg-emerald-500 text-white shadow';
    dom.btnModeCampaign.className = 'rounded-xl py-2 px-2.5 sm:px-3 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider transition cursor-pointer text-slate-300 hover:text-white';
  });

  dom.skinButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedSkin = btn.getAttribute('data-skin') || 'executivo';
      dom.skinButtons.forEach((b) => {
        const active = b.getAttribute('data-skin') === state.selectedSkin;
        b.className = active
          ? 'skin-btn rounded-2xl bg-sky-500/25 border border-sky-400/75 p-1.5 sm:p-2 text-center transition cursor-pointer shadow flex flex-col items-center'
          : 'skin-btn rounded-2xl bg-white/5 border border-white/10 p-1.5 sm:p-2 text-center transition cursor-pointer hover:border-white/30 flex flex-col items-center';
      });
    });
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
    if (state.gameState !== 'PLAYING') render();
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      resizeCanvas();
      if (state.gameState !== 'PLAYING') render();
    }, 180);
  });

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType) {
      state.lastInputWasTouch = e.pointerType === 'touch';
    }
  }, { capture: true, passive: true });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    state.lastInputWasTouch = e.pointerType === 'touch';
    syncTouchZoneGuides();
    state.pointerDownY = e.clientY;
    state.swipeHandled = false;

    if (e.pointerType === 'touch' && state.gameState === 'PLAYING' && !state.isPaused && state.currentAct < 3 && state.touchControlMode === 'split') {
      if (e.cancelable) e.preventDefault();
      audio.init();
      const relX = e.clientX / Math.max(1, window.innerWidth);
      if (relX < 0.42) {
        state.swipeHandled = true;
        state.isHoldingAction = false;
        handleDuckOrFastFall();
        pulseTouchPill(dom.touchPillLeft);
        return;
      }
      pulseTouchPill(dom.touchPillRight);
      handleActionPress(e);
      return;
    }

    handleActionPress(e);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!state.swipeHandled && state.gameState === 'PLAYING' && !state.isPaused && (e.buttons > 0 || e.pointerType === 'touch')) {
      if (e.clientY - state.pointerDownY > 36) {
        state.swipeHandled = true;
        state.isHoldingAction = false;
        handleDuckOrFastFall();
      }
    }
  });

  canvas.addEventListener('pointerup', handleActionRelease);

  canvas.addEventListener('pointercancel', handleActionRelease);

  canvas.addEventListener('pointerleave', handleActionRelease);

  window.addEventListener('keydown', (e) => {
    if (dom.garageOverlay && !dom.garageOverlay.classList.contains('hidden')) {
      if (e.code === 'Escape') {
        e.preventDefault();
        closeGarage();
      }
      return;
    }

    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state.gameState === 'PLAYING') {
        e.preventDefault();
        togglePause();
        return;
      }
    }

    if (e.code === 'KeyM' && !e.repeat) {
      e.preventDefault();
      toggleMutePreference();
      return;
    }

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      if (state.gameState === 'START' && !e.repeat) {
        e.preventDefault();
        state.lastInputWasTouch = false;
        startGame();
        return;
      }
      if (state.gameState === 'GAMEOVER' && !e.repeat) {
        e.preventDefault();
        state.lastInputWasTouch = false;
        startGame();
        return;
      }
      if (state.gameState === 'PLAYING') {
        e.preventDefault();
        state.lastInputWasTouch = false;
        if (state.isPaused) {
          togglePause(false);
          return;
        }
        syncTouchZoneGuides();
        if (!e.repeat) {
          handleActionPress();
        }
        state.isHoldingAction = true;
      }
    } else if (e.code === 'Enter' && !e.repeat) {
      if (state.gameState === 'START' || state.gameState === 'GAMEOVER') {
        e.preventDefault();
        state.lastInputWasTouch = false;
        startGame();
      } else if (state.gameState === 'PLAYING' && state.isPaused) {
        e.preventDefault();
        state.lastInputWasTouch = false;
        togglePause(false);
      }
    } else if ((e.code === 'ArrowDown' || e.code === 'KeyS') && !e.repeat) {
      if (state.gameState === 'PLAYING' && !state.isPaused) {
        e.preventDefault();
        state.lastInputWasTouch = false;
        syncTouchZoneGuides();
        handleDuckOrFastFall();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      state.isHoldingAction = false;
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.isHoldingAction = false;
      if (state.gameState === 'PLAYING' && !state.isPaused) {
        togglePause(true);
      } else {
        audio.pauseBgm(true);
      }
      try { if (audio.ctx && audio.ctx.state === 'running') audio.ctx.suspend().catch(() => {}); } catch (e) {}
    } else {
      try { if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {}); } catch (e) {}
      if (state.gameState === 'PLAYING' && !state.isPaused && audio.bgmWanted && audio.musicEnabled && !audio.muted) {
        audio.playBgm(false);
      }
    }
  });

  dom.btnSwapRoast.addEventListener('click', (e) => {
    e.stopPropagation();
    cycleRoast(true);
  });

  dom.btnDownloadCard.addEventListener('click', (e) => {
    e.stopPropagation();
    generateAndDownloadShareCard();
  });

  dom.btnStart.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
  });

  dom.btnStartMusic.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMusicPreference();
  });

  dom.btnTouchMode.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTouchModePreference();
  });

  dom.btnRestart.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
  });

  dom.btnOpenGarage.addEventListener('click', (e) => {
    e.stopPropagation();
    openGarage();
  });

  dom.btnGameOverGarage.addEventListener('click', (e) => {
    e.stopPropagation();
    openGarage();
  });

  dom.btnCloseGarage.addEventListener('click', (e) => {
    e.stopPropagation();
    closeGarage();
  });

  dom.garageOverlay.addEventListener('click', (e) => {
    if (e.target === dom.garageOverlay) {
      closeGarage();
    }
  });

  dom.btnGameOverMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    returnToMenu();
  });

  dom.btnPause.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePause();
  });

  dom.btnResume.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePause(false);
  });

  dom.btnPauseMusic.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMusicPreference();
  });

  dom.btnPauseTouchMode.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTouchModePreference();
  });

  dom.btnPauseRestart.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
  });

  dom.btnPauseMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    returnToMenu();
  });

  dom.btnMute.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMutePreference();
  });

  const fsSupported = Boolean(
    document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen
  );

  if (!fsSupported && dom.btnFullscreen) {
    dom.btnFullscreen.classList.add('hidden');
  }

  function syncFullscreenIcon() {
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    dom.iconFsEnter.classList.toggle('hidden', isFs);
    dom.iconFsExit.classList.toggle('hidden', !isFs);
  }

  if (dom.btnFullscreen && fsSupported) {
    dom.btnFullscreen.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
        if (isFs) {
          const exit = document.exitFullscreen || document.webkitExitFullscreen;
          if (exit) Promise.resolve(exit.call(document)).catch(() => {});
        } else {
          const el = document.documentElement;
          const req = el.requestFullscreen || el.webkitRequestFullscreen;
          if (req) Promise.resolve(req.call(el)).catch(() => {});
        }
      } catch (err) {}
    });
    document.addEventListener('fullscreenchange', syncFullscreenIcon);
    document.addEventListener('webkitfullscreenchange', syncFullscreenIcon);
  }

  dom.btnCopyResult.addEventListener('click', (e) => {
    e.stopPropagation();
    const ptsText = Math.floor(state.score).toLocaleString('pt-BR');
    const distText = Math.floor(state.distanceMeters).toLocaleString('pt-BR');
    const actShort = state.currentAct === 3 ? 'decolou no Ato 3 (Voo da Fuga)' : `chegou ao Ato ${state.currentAct}`;
    const url = window.location.href;
    const shareMsg = `Operação 24h: Voo da Fuga — ${ptsText} pts (${distText} m) • Patente: ${state.currentRankText} • "${state.currentRoastText}" (${actShort}) ${url}`;

    let copied = false;
    try {
      const ta = document.createElement('textarea');
      ta.value = shareMsg;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (err) {}

    if (!copied && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareMsg).catch(() => {});
    }

    dom.iconCopy.classList.add('hidden');
    dom.iconCopied.classList.remove('hidden');
    dom.btnCopyText.textContent = 'Copiado!';
    setTimeout(() => {
      dom.iconCopy.classList.remove('hidden');
      dom.iconCopied.classList.add('hidden');
      dom.btnCopyText.textContent = 'Copiar Texto';
    }, 2400);
  });
}
