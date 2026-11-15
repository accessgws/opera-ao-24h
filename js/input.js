// =============================================================================
// CONTROLES (TECLADO, TOQUE, MOUSE, BOTÕES E FULLSCREEN)
// =============================================================================

import { audio } from './audio.js';
import { IS_COARSE_POINTER } from './config.js';
import { dom, canvas } from './dom.js';
import { resizeCanvas, render, syncTouchZoneGuides, handleDuckOrFastFall, pulseTouchPill, handleActionPress, handleActionRelease, togglePause, startGame, returnToMenu } from './gameplay.js';
import { state } from './state.js';
import { closeGarage, toggleMutePreference, cycleRoast, generateAndDownloadShareCard, toggleMusicPreference, toggleTouchModePreference, openGarage } from './ui.js';
import { mpState, openMultiplayer, closeMultiplayer, connectToRoom, leaveRoom, requestMpStartMatch, sendMpSkin, sendMpMode, generateRoomCode, sanitizeRoomCode } from './multiplayer.js';

export function initInputListeners() {
  const handleRestartAction = () => {
    if (mpState.connected && mpState.inMatch) {
      if (mpState.youId && mpState.youId === mpState.hostId) {
        requestMpStartMatch();
      } else {
        openMultiplayer();
      }
      return;
    }
    startGame();
  };

  dom.btnModeCampaign.addEventListener('click', () => {
    state.selectedGameMode = 'campaign';
    dom.btnModeCampaign.className = 'rounded-xl py-2 px-2.5 sm:px-3 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider transition cursor-pointer bg-sky-500 text-white shadow';
    dom.btnModeClassic.className = 'rounded-xl py-2 px-2.5 sm:px-3 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider transition cursor-pointer text-slate-300 hover:text-white';
    sendMpMode('campaign');
  });

  dom.btnModeClassic.addEventListener('click', () => {
    state.selectedGameMode = 'classic';
    dom.btnModeClassic.className = 'rounded-xl py-2 px-2.5 sm:px-3 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider transition cursor-pointer bg-emerald-500 text-white shadow';
    dom.btnModeCampaign.className = 'rounded-xl py-2 px-2.5 sm:px-3 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider transition cursor-pointer text-slate-300 hover:text-white';
    sendMpMode('classic');
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
      sendMpSkin(state.selectedSkin);
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
    if (dom.multiplayerOverlay && !dom.multiplayerOverlay.classList.contains('hidden')) {
      if (e.code === 'Escape') {
        e.preventDefault();
        closeMultiplayer();
      }
      return;
    }

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
        handleRestartAction();
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
      if (state.gameState === 'START') {
        e.preventDefault();
        state.lastInputWasTouch = false;
        startGame();
      } else if (state.gameState === 'GAMEOVER') {
        e.preventDefault();
        state.lastInputWasTouch = false;
        handleRestartAction();
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
    handleRestartAction();
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
    syncMobileOrientBanner();
  }

  let orientBannerDismissed = false;
  let deferredInstallPrompt = null;
  const isIosDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  function isPwaStandalone() {
    return Boolean(
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true
    );
  }

  function syncMobileOrientBanner() {
    if (!dom.mobileOrientBanner) return;
    const isMobile = state.lastInputWasTouch || IS_COARSE_POINTER || isIosDevice;
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    const isStandalone = isPwaStandalone();
    const isPortrait = window.innerHeight > window.innerWidth;
    const canOfferInstall = !isStandalone && (Boolean(deferredInstallPrompt) || isIosDevice);
    const shouldShow = isMobile && !orientBannerDismissed && (isPortrait || (!isFs && !isStandalone) || canOfferInstall);

    dom.mobileOrientBanner.classList.toggle('hidden', !shouldShow);
    if (shouldShow && dom.mobileOrientText) {
      if (isPortrait) {
        dom.mobileOrientText.textContent = '📱 Gire a tela e ative Tela Cheia';
      } else if (canOfferInstall) {
        dom.mobileOrientText.textContent = '📲 Instale como App no celular';
      } else {
        dom.mobileOrientText.textContent = '⛶ Toque para jogar em Tela Cheia';
      }
    }
    if (dom.btnBannerFullscreen) {
      dom.btnBannerFullscreen.classList.toggle('hidden', isFs || isStandalone || !fsSupported);
    }
    if (dom.btnInstallPwa) {
      dom.btnInstallPwa.classList.toggle('hidden', !canOfferInstall);
      if (canOfferInstall) {
        dom.btnInstallPwa.textContent = isIosDevice ? '📲 Instalar (iPhone)' : '📲 Instalar App';
      }
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    syncMobileOrientBanner();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    syncMobileOrientBanner();
  });

  if (dom.btnInstallPwa) {
    dom.btnInstallPwa.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isIosDevice) {
        if (dom.iosInstallModal) dom.iosInstallModal.classList.remove('hidden');
        return;
      }
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        Promise.resolve(deferredInstallPrompt.userChoice).then(() => {
          deferredInstallPrompt = null;
          syncMobileOrientBanner();
        }).catch(() => {});
      }
    });
  }

  if (dom.btnCloseIosInstall && dom.iosInstallModal) {
    dom.btnCloseIosInstall.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.iosInstallModal.classList.add('hidden');
    });
    dom.iosInstallModal.addEventListener('click', (e) => {
      if (e.target === dom.iosInstallModal) dom.iosInstallModal.classList.add('hidden');
    });
  }

  function requestToggleFullscreen() {
    try {
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      if (isFs) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) Promise.resolve(exit.call(document)).catch(() => {});
      } else {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
          Promise.resolve(req.call(el)).then(() => {
            if ((state.lastInputWasTouch || IS_COARSE_POINTER) && screen.orientation && typeof screen.orientation.lock === 'function') {
              screen.orientation.lock('landscape').catch(() => {});
            }
          }).catch(() => {});
        }
      }
    } catch (err) {}
  }

  if (dom.btnFullscreen && fsSupported) {
    dom.btnFullscreen.addEventListener('click', (e) => {
      e.stopPropagation();
      requestToggleFullscreen();
    });
    document.addEventListener('fullscreenchange', syncFullscreenIcon);
    document.addEventListener('webkitfullscreenchange', syncFullscreenIcon);
  }

  if (dom.btnBannerFullscreen) {
    dom.btnBannerFullscreen.addEventListener('click', (e) => {
      e.stopPropagation();
      requestToggleFullscreen();
    });
  }

  if (dom.btnDismissOrientBanner) {
    dom.btnDismissOrientBanner.addEventListener('click', (e) => {
      e.stopPropagation();
      orientBannerDismissed = true;
      syncMobileOrientBanner();
    });
  }

  window.addEventListener('resize', syncMobileOrientBanner);
  window.addEventListener('orientationchange', () => setTimeout(syncMobileOrientBanner, 200));
  syncMobileOrientBanner();

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

  if (dom.btnOpenMultiplayer) {
    dom.btnOpenMultiplayer.addEventListener('click', (e) => {
      e.stopPropagation();
      openMultiplayer();
    });
  }

  if (dom.btnCloseMultiplayer) {
    dom.btnCloseMultiplayer.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMultiplayer();
    });
  }

  if (dom.btnMpCreateRoom) {
    dom.btnMpCreateRoom.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = generateRoomCode();
      if (dom.mpRoomCodeInput) dom.mpRoomCodeInput.value = code;
      connectToRoom(code);
    });
  }

  if (dom.btnMpJoinRoom) {
    dom.btnMpJoinRoom.addEventListener('click', (e) => {
      e.stopPropagation();
      connectToRoom(dom.mpRoomCodeInput ? dom.mpRoomCodeInput.value : '');
    });
  }

  if (dom.mpRoomCodeInput) {
    dom.mpRoomCodeInput.addEventListener('input', () => {
      dom.mpRoomCodeInput.value = sanitizeRoomCode(dom.mpRoomCodeInput.value);
    });
    dom.mpRoomCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        connectToRoom(dom.mpRoomCodeInput.value);
      }
    });
  }

  if (dom.btnMpCopyLink) {
    dom.btnMpCopyLink.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!mpState.roomCode) return;
      const inviteUrl = `${location.origin}${location.pathname}?sala=${encodeURIComponent(mpState.roomCode)}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(inviteUrl).catch(() => {});
      }
      const prev = dom.btnMpCopyLink.textContent;
      dom.btnMpCopyLink.textContent = 'Link Copiado!';
      setTimeout(() => {
        if (dom.btnMpCopyLink) dom.btnMpCopyLink.textContent = prev;
      }, 2000);
    });
  }

  if (dom.btnMpLeaveRoom) {
    dom.btnMpLeaveRoom.addEventListener('click', (e) => {
      e.stopPropagation();
      leaveRoom(true);
    });
  }

  if (dom.btnMpStartMatch) {
    dom.btnMpStartMatch.addEventListener('click', (e) => {
      e.stopPropagation();
      requestMpStartMatch();
    });
  }

  if (dom.btnGameOverMpRoom) {
    dom.btnGameOverMpRoom.addEventListener('click', (e) => {
      e.stopPropagation();
      openMultiplayer();
    });
  }
}
