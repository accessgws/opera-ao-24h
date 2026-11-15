// =============================================================================
// MOTOR DE FÍSICA, COLISÕES, SPAWNERS E LOOP PRINCIPAL DE JOGO
// =============================================================================

import { audio } from './audio.js';
import { LOGICAL_HEIGHT, MIN_LOGICAL_WIDTH, ACT2_DISTANCE, ACT3_DISTANCE, ceilingY, HOURS_PER_SECOND } from './config.js';
import { canvas, dom, ctx } from './dom.js';
import { drawTransitionProps, drawRemoteRivals, drawPlayer, drawImpactComedyEffects } from './render/player.js';
import { drawPursuer } from './render/pursuers.js';
import { spawnExplosion, addFloatingText, spawnDust, drawBackground, drawCollectibles, drawObstacles, drawParticlesAndEffects } from './render/world.js';
import { state, player, triggerHaptic, upgrades, saySpeech, adjustPursuerGap } from './state.js';
import { saveProgressState, rollCompletedMissions, resetPerRunMissions, getShieldPostInvuln, getMagnetRadius, getCoffeeFreezeDuration, getTurboDuration } from './storage.js';
import { closeGarage, syncProgressUI, syncActHUD, updateHUD, showActBanner, showControlHintForAct, finalizeGameOver, trackMissionProgress, addRunStars, triggerGameOver, registerComboHit } from './ui.js';
import { mpState, nextRand, seedMatchPrng, sendMpTick, updateMultiplayerHUD, registerMatchStartHandler } from './multiplayer.js';

export function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));

  // Em telas retrato estreitas, reduz o zoom horizontal para garantir >= 720px lógicos
  const scaleByH = canvas.height / LOGICAL_HEIGHT;
  const scaleByMinW = canvas.width / MIN_LOGICAL_WIDTH;
  state.renderScale = Math.min(scaleByH, scaleByMinW);

  state.logicalWidth = canvas.width / state.renderScale;
  state.logicalHeight = canvas.height / state.renderScale;
  state.worldOffsetY = Math.max(0, Math.round((state.logicalHeight - LOGICAL_HEIGHT) * 0.62));
  state.groundY = LOGICAL_HEIGHT - 86;

  player.x = Math.max(150, Math.min(310, state.logicalWidth * 0.27));
}

export function executeJumpOrHop() {
  if (state.currentAct === 1) {
    const canFirstJump = player.jumpsUsed === 0 && (player.y >= state.groundY - 2 || state.coyoteTimer > 0);
    const canDoubleJump = player.jumpsUsed === 1;

    if (canFirstJump || canDoubleJump) {
      const isDouble = player.jumpsUsed === 1;
      player.vy = isDouble ? -600 : -675;
      player.jumpsUsed += 1;
      player.slideTimer = 0;
      state.coyoteTimer = 0;
      state.jumpBufferTimer = 0;
      player.squashX = 0.84;
      player.squashY = 1.18;
      audio.playJump(isDouble);
      triggerHaptic(isDouble ? 14 : 9);
      if (isDouble) {
        player.isFlipping = true;
        player.flipAngle = 0;
        spawnExplosion(player.x, player.y - 32, '#ffffff', 14);
        addFloatingText(player.x, player.y - 54, 'Pulo Duplo!', '#e0f2fe');
      } else {
        player.isFlipping = false;
        player.flipAngle = 0;
        spawnDust(player.x, state.groundY, 7, '#bbf7d0');
      }
      return true;
    }
  } else if (state.currentAct === 2) {
    if (player.jumpsUsed < 2) {
      const isMidAirBoost = player.jumpsUsed === 1;
      player.vy = isMidAirBoost ? -585 : -675;
      player.jumpsUsed += 1;
      player.suspOffset = -5;
      state.jumpBufferTimer = 0;
      audio.playCarHop();
      triggerHaptic(isMidAirBoost ? 14 : 10);
      spawnExplosion(player.x - 36, player.y, isMidAirBoost ? '#38bdf8' : '#facc15', 11);
      if (isMidAirBoost) {
        addFloatingText(player.x, player.y - 44, 'Nitro Hidráulico!', '#7dd3fc');
      }
      return true;
    }
  }
  return false;
}

export function handleDuckOrFastFall() {
  if (state.gameState !== 'PLAYING' || state.isPaused) return;
  if (state.currentAct === 1) {
    if (player.y >= state.groundY - 4) {
      // Slide tático no chão
      if (player.slideTimer <= 0.15) {
        audio.playSlide();
        spawnDust(player.x - 14, state.groundY, 8, '#cbd5e1');
      }
      player.slideTimer = 0.58;
      player.squashX = 1.18;
      player.squashY = 0.80;
    } else {
      // Fast-fall no ar
      player.vy = Math.max(player.vy, 720);
      player.slideTimer = 0.25;
    }
  } else if (state.currentAct === 2) {
    if (player.y < state.groundY - 4) {
      player.vy = Math.max(player.vy, 760);
    }
  }
}

export function handleActionPress(e) {
  if (e && e.cancelable) e.preventDefault();
  audio.init();
  if (state.gameState !== 'PLAYING' || state.isPaused) return;

  state.isHoldingAction = true;

  if (state.currentAct === 1 || state.currentAct === 2) {
    if (!executeJumpOrHop()) {
      // Jump Buffer de 120ms caso aperte pouco antes de tocar o chão
      state.jumpBufferTimer = 0.12;
    }
  }
}

export function handleActionRelease(e) {
  if (e && e.cancelable) e.preventDefault();
  state.isHoldingAction = false;
}

export function pulseTouchPill(el) {
  if (!el) return;
  el.style.transform = 'scale(0.92)';
  setTimeout(() => {
    el.style.transform = '';
  }, 110);
}

export function syncTouchZoneGuides() {
  if (!dom.touchZoneGuides) return;
  const showGuides = state.gameState === 'PLAYING'
    && !state.isPaused
    && state.currentAct < 3
    && state.lastInputWasTouch
    && state.touchControlMode === 'split';
  dom.touchZoneGuides.classList.toggle('hidden', !showGuides);
  if (showGuides && dom.controlHint && window.innerHeight <= 500) {
    dom.controlHint.classList.add('hidden');
  }
  if (showGuides && dom.touchPillLeft) {
    dom.touchPillLeft.textContent = state.currentAct === 1 ? '↓ Deslizar' : '↓ Aterrissar';
  }
  if (showGuides && dom.touchPillRight) {
    dom.touchPillRight.textContent = state.currentAct === 1 ? '↑ Pular' : '↑ Salto';
  }
}

export function togglePause(forceState) {
  if (state.gameState !== 'PLAYING') return;
  state.isPaused = forceState !== undefined ? forceState : !state.isPaused;
  state.isHoldingAction = false;
  dom.pauseOverlay.classList.toggle('hidden', !state.isPaused);
  dom.iconPause.classList.toggle('hidden', state.isPaused);
  dom.iconResume.classList.toggle('hidden', !state.isPaused);
  if (state.isPaused) {
    saveProgressState();
    audio.updateVehicleHum(false, state.currentAct, false);
    audio.pauseBgm(false);
  } else {
    player.invulnTimer = Math.max(player.invulnTimer, 0.55);
    addFloatingText(player.x + 12, player.y - 46, 'Retomado!', '#7dd3fc');
    audio.playBgm(false);
  }
  syncTouchZoneGuides();
}

export function startGame(fromMultiplayer = false) {
  audio.init();
  closeGarage();
  rollCompletedMissions();
  resetPerRunMissions();

  if (fromMultiplayer) {
    mpState.inMatch = true;
    state.selectedGameMode = mpState.mode || state.selectedGameMode;
    seedMatchPrng(mpState.seed);
  } else {
    mpState.inMatch = false;
  }
  if (dom.gameOverMpBanner) dom.gameOverMpBanner.classList.add('hidden');
  if (dom.hudMpPill) dom.hudMpPill.classList.toggle('hidden', !(fromMultiplayer && mpState.connected));

  const startAct = state.selectedGameMode === 'classic' ? 3 : 1;
  audio.startMusic(startAct);

  state.gameState = 'PLAYING';
  state.isPaused = false;
  state.currentAct = startAct;
  state.isHoldingAction = false;
  state.runStars = 0;
  state.missionToastTimer = 0;
  if (dom.missionToast) dom.missionToast.classList.add('hidden');
  dom.pauseOverlay.classList.add('hidden');
  dom.newRecordBadge.classList.add('hidden');
  dom.iconPause.classList.remove('hidden');
  dom.iconResume.classList.add('hidden');

  state.distanceMeters = 0;
  state.score = 0;
  state.nearMissCount = 0;
  state.comboCount = 0;
  state.comboTimer = 0;
  state.maxCombo = 0;
  state.clockHours = 24.0;
  state.clockFreezeTimer = 0;
  state.tailwindTimer = 0;
  state.nextMilestoneDist = 500;
  state.beatHighScoreBannerShown = false;
  state.endlessFlightSeconds = 0;
  state.currentSpeed = startAct === 3 ? 420 : 350;
  state.screenShake = 0;
  state.sirenFlashTimer = 0;
  state.transitionFlash = 0;
  state.transitionProp = null;
  state.jumpBufferTimer = 0;
  state.coyoteTimer = 0;
  state.impactTimer = 0;
  state.dizzyStarAngle = 0;
  state.lastImpactMeta = null;
  state.pursuerGap = 62;
  state.pursuerVisualGap = 62;
  state.speechTimer = 0;
  state.speechText = '';

  player.y = startAct === 3 ? LOGICAL_HEIGHT * 0.42 : state.groundY;
  player.vy = 0;
  player.jumpsUsed = 0;
  player.runCycle = 0;
  player.flipAngle = 0;
  player.isFlipping = false;
  player.slideTimer = 0;
  player.squashX = 1;
  player.squashY = 1;
  player.suspOffset = 0;
  player.suspVel = 0;
  player.blinkTimer = 2.0;
  player.emotionTimer = 0;
  player.emotionType = 'normal';
  player.wheelAngle = 0;
  player.propAngle = 0;
  player.pitch = 0;
  player.hasShield = upgrades.startShield >= 1;
  player.turboTimer = 0;
  player.invulnTimer = 0;

  state.obstacles = [];
  state.collectibles = [];
  state.particles = [];
  state.floatingTexts = [];
  state.speedLines = [];

  state.obstacleTimer = 1.05;
  state.collectibleTimer = 0.75;
  state.trailTimer = 0;
  state.dustTimer = 0;

  dom.startOverlay.classList.add('hidden');
  dom.gameOverOverlay.classList.add('hidden');
  dom.hudLeftSpacer.classList.add('hidden');
  dom.hudLeftGroup.classList.remove('hidden');
  dom.hudClockPill.classList.remove('hidden');
  dom.btnPause.classList.remove('hidden');

  syncProgressUI();
  syncActHUD(startAct);
  updateHUD();
  if (startAct === 3) {
    showActBanner('Modo Clássico (V1)', 'VOO DA FUGA DIRETO');
    saySpeech('Decolando sem escalas!', 2.4);
  } else {
    showActBanner('Perdeu a Eleição! 24:00h no Relógio', 'ATO 1: FUJA DA ESQUERDA');
    saySpeech('Perdi! A esquerda vem atrás!', 2.8);
  }
  showControlHintForAct(startAct);
  syncTouchZoneGuides();
}

export function returnToMenu() {
  saveProgressState();
  mpState.inMatch = false;
  if (dom.hudMpPill) dom.hudMpPill.classList.add('hidden');
  if (dom.gameOverMpBanner) dom.gameOverMpBanner.classList.add('hidden');
  state.gameState = 'START';
  state.isPaused = false;
  state.isHoldingAction = false;
  state.currentAct = 1;
  state.runStars = 0;
  state.missionToastTimer = 0;
  state.distanceMeters = 0;
  state.score = 0;
  state.nearMissCount = 0;
  state.comboCount = 0;
  state.comboTimer = 0;
  state.maxCombo = 0;
  state.clockHours = 24.0;
  state.clockFreezeTimer = 0;
  state.tailwindTimer = 0;
  state.nextMilestoneDist = 500;
  state.beatHighScoreBannerShown = false;
  state.endlessFlightSeconds = 0;
  state.currentSpeed = 350;
  state.screenShake = 0;
  state.sirenFlashTimer = 0;
  state.transitionFlash = 0;
  state.transitionProp = null;
  state.impactTimer = 0;
  state.lastImpactMeta = null;
  state.pursuerGap = 62;
  state.pursuerVisualGap = 62;
  state.speechTimer = 0;
  state.speechText = '';

  player.y = state.groundY;
  player.vy = 0;
  player.jumpsUsed = 0;
  player.flipAngle = 0;
  player.isFlipping = false;
  player.slideTimer = 0;
  player.pitch = 0;
  player.hasShield = false;
  player.turboTimer = 0;
  player.invulnTimer = 0;
  player.emotionType = 'normal';
  player.emotionTimer = 0;

  state.obstacles = [];
  state.collectibles = [];
  state.particles = [];
  state.floatingTexts = [];
  state.speedLines = [];

  audio.stopMusic();

  dom.pauseOverlay.classList.add('hidden');
  dom.gameOverOverlay.classList.add('hidden');
  dom.garageOverlay.classList.add('hidden');
  dom.newRecordBadge.classList.add('hidden');
  dom.actBanner.classList.add('hidden');
  if (dom.missionToast) dom.missionToast.classList.add('hidden');
  dom.controlHint.classList.add('hidden');
  dom.btnPause.classList.add('hidden');
  dom.iconPause.classList.remove('hidden');
  dom.iconResume.classList.add('hidden');

  dom.hudLeftGroup.classList.add('hidden');
  dom.hudClockPill.classList.add('hidden');
  dom.hudTurboPill.classList.add('hidden');
  dom.hudCoffeePill.classList.add('hidden');
  if (dom.hudWindPill) dom.hudWindPill.classList.add('hidden');
  dom.hudShieldPill.classList.add('hidden');
  dom.hudComboPill.classList.add('hidden');
  dom.hudLeftSpacer.classList.remove('hidden');

  syncActHUD(1);
  syncProgressUI();
  dom.startHighScore.textContent = `${state.highScore.toLocaleString('pt-BR')} pts`;
  dom.startOverlay.classList.remove('hidden');
  syncTouchZoneGuides();
  render();
}

export function spawnObstacle() {
  // Pausa spawn nos últimos 55m antes das trocas de veículo para transição limpa
  if (state.currentAct === 1 && state.distanceMeters > ACT2_DISTANCE - 55) return;
  if (state.currentAct === 2 && state.distanceMeters > ACT3_DISTANCE - 65) return;

  const spawnX = state.logicalWidth + 110;

  if (state.currentAct === 1) {
    // ATO 1 (A pé no Planalto): Tripés, Faixas, Cavaletes, Drones e Microfone Boom suspenso
    const roll = nextRand();
    if (roll < 0.24) {
      state.obstacles.push({
        type: 'camera_tripod',
        x: spawnX,
        y: state.groundY,
        width: 48,
        height: 64,
        blink: 0
      });
    } else if (roll < 0.48) {
      const slogans = ['SEM ANISTIA!', 'FIM DE MANDATO!', 'VOLTA PRA URNA!', 'PERDEU!!'];
      state.obstacles.push({
        type: 'protest_banner',
        x: spawnX,
        y: state.groundY,
        width: 82,
        height: 56,
        slogan: slogans[Math.floor(nextRand() * slogans.length)],
        phase: nextRand() * Math.PI * 2
      });
    } else if (roll < 0.68) {
      state.obstacles.push({
        type: 'cavalete',
        x: spawnX,
        y: state.groundY,
        width: 56,
        height: 46
      });
    } else if (roll < 0.84) {
      // Drone de TV voando na altura da cabeça: pode dar Slide por baixo ou Pular por cima
      const hoverBase = state.groundY - 58;
      state.obstacles.push({
        type: 'press_drone',
        x: spawnX,
        y: hoverBase,
        baseY: hoverBase,
        width: 64,
        height: 36,
        phase: nextRand() * Math.PI * 2,
        blink: 0
      });
    } else {
      // Microfone Boom AO VIVO suspenso na altura da cabeça: ideal para Slide (↓) ou toque esquerdo
      const hoverBase = state.groundY - 56;
      state.obstacles.push({
        type: 'boom_mic',
        x: spawnX,
        y: hoverBase,
        baseY: hoverBase,
        width: 66,
        height: 34,
        phase: nextRand() * Math.PI * 2,
        blink: 0
      });
    }
  } else if (state.currentAct === 2) {
    // ATO 2 (De Carro no Eixo): Cones, Blitz Vermelha, Radar Móvel e Martelo Rolante
    const roll = nextRand();
    if (roll < 0.30) {
      state.obstacles.push({
        type: 'traffic_cones',
        x: spawnX,
        y: state.groundY,
        width: 78,
        height: 42
      });
    } else if (roll < 0.56) {
      state.obstacles.push({
        type: 'blitz_block',
        x: spawnX,
        y: state.groundY,
        width: 68,
        height: 56,
        blink: 0
      });
    } else if (roll < 0.80) {
      state.obstacles.push({
        type: 'radar_van',
        x: spawnX,
        y: state.groundY,
        width: 74,
        height: 48,
        blink: 0
      });
    } else {
      state.obstacles.push({
        type: 'gavel_barrier',
        x: spawnX,
        y: state.groundY - 26,
        radius: 26,
        angle: 0
      });
    }
  } else {
    // ATO 3 (De Avião): Martelos da Toga, Bloqueios Vermelhos, Helicóptero da Imprensa e Processos
    const act3Dist = state.selectedGameMode === 'classic' ? state.distanceMeters : Math.max(0, state.distanceMeters - ACT3_DISTANCE);
    const difficulty = Math.min(1, act3Dist / 1400);
    const roll = nextRand();

    if (difficulty >= 0.14 && nextRand() < 0.22) {
      const y = ceilingY + 95 + nextRand() * (state.groundY - ceilingY - 190);
      state.obstacles.push({
        type: 'sky_helicopter',
        x: spawnX,
        y: y,
        baseY: y,
        width: 88,
        height: 42,
        bobAmp: 38,
        bobFreq: 1.9,
        time: nextRand() * Math.PI * 2,
        blink: 0
      });
    } else if (roll < 0.36) {
      const y = ceilingY + 95 + nextRand() * (state.groundY - ceilingY - 190);
      state.obstacles.push({
        type: 'sky_gavel',
        x: spawnX,
        y: y,
        baseY: y,
        radius: 36,
        angle: 0,
        spinSpeed: 2.2 + difficulty * 1.4,
        bobAmp: 34 + nextRand() * 24,
        bobFreq: 1.8 + nextRand() * 0.8,
        time: nextRand() * Math.PI * 2
      });
    } else if (roll < 0.72) {
      const placement = Math.floor(nextRand() * 3);
      const barW = 54;
      const barH = placement === 2 ? 140 + difficulty * 45 : 180 + difficulty * 60;
      const barY = placement === 0 ? 0 : placement === 1 ? state.groundY - barH : ceilingY + 95 + nextRand() * (state.groundY - ceilingY - barH - 190);
      state.obstacles.push({
        type: 'sky_barrier',
        x: spawnX,
        y: barY,
        width: barW,
        height: barH,
        blink: 0
      });
    } else {
      const targetY = Math.max(ceilingY + 60, Math.min(state.groundY - 60, player.y + (nextRand() - 0.5) * 140));
      audio.playWarningBeep();
      state.obstacles.push({
        type: 'sky_dossier',
        x: state.logicalWidth + 95,
        y: targetY,
        width: 82,
        height: 44,
        warningTimer: 1.1,
        speedMult: 1.85,
        tilt: 0
      });
    }
  }
}

export function spawnCollectibles() {
  const spawnX = state.logicalWidth + 80;

  if (state.currentAct === 1 || state.currentAct === 2) {
    const canSpawnRamp = state.currentAct === 2 && !state.obstacles.some((o) => Math.abs(o.x - spawnX) < 160);
    const roll = nextRand();
    if (canSpawnRamp && roll < 0.16) {
      // Rampa amarela de escape no asfalto (apenas com pista livre à frente)
      const y = state.groundY - 12;
      state.collectibles.push({
        type: 'road_ramp',
        x: spawnX,
        y: y,
        baseY: y,
        radius: 28,
        phase: 0
      });
    } else if (roll < (canSpawnRamp ? 0.36 : 0.26)) {
      // Café Expresso / Atalho (congela o relógio de 24h por 4s)
      const y = state.groundY - (state.currentAct === 1 ? 82 : 76);
      state.collectibles.push({
        type: 'coffee',
        x: spawnX,
        y: y,
        baseY: y,
        radius: 22,
        phase: 0
      });
    } else if (roll < (canSpawnRamp ? 0.50 : 0.40) && !player.hasShield) {
      const y = state.groundY - 90;
      state.collectibles.push({
        type: 'shield',
        x: spawnX,
        y: y,
        baseY: y,
        radius: 21,
        phase: 0
      });
    } else {
      // Estrelas de Apoio em arco de pulo
      const count = 3;
      for (let i = 0; i < count; i++) {
        const arcY = state.groundY - 46 - Math.sin((i / 2) * Math.PI) * 58;
        state.collectibles.push({
          type: 'star',
          x: spawnX + i * 52,
          y: arcY,
          baseY: arcY,
          radius: 17,
          phase: i * 0.4
        });
      }
    }
  } else {
    // Coletáveis do Ato 3 (Voo): Escudo, Turbo, Corrente de Jato e Anéis Aéreos de Bônus
    const roll = nextRand();
    if (roll < 0.14 && !player.hasShield) {
      const y = ceilingY + 90 + nextRand() * (state.groundY - ceilingY - 180);
      state.collectibles.push({ type: 'shield', x: spawnX, y, baseY: y, radius: 22, phase: 0 });
    } else if (roll < 0.26 && player.turboTimer <= 0) {
      const y = ceilingY + 90 + nextRand() * (state.groundY - ceilingY - 180);
      state.collectibles.push({ type: 'turbo', x: spawnX, y, baseY: y, radius: 22, phase: 0 });
    } else if (roll < 0.44 && state.tailwindTimer <= 0) {
      const y = ceilingY + 95 + nextRand() * (state.groundY - ceilingY - 190);
      state.collectibles.push({ type: 'wind_stream', x: spawnX, y, baseY: y, radius: 26, phase: 0 });
    } else if (roll < 0.60) {
      const y = ceilingY + 100 + nextRand() * (state.groundY - ceilingY - 200);
      state.collectibles.push({ type: 'ring', x: spawnX, y, baseY: y, radius: 30, phase: 0 });
    } else {
      const count = 3 + Math.floor(nextRand() * 2);
      const startY = ceilingY + 110 + nextRand() * (state.groundY - ceilingY - 220);
      for (let i = 0; i < count; i++) {
        const arcOffset = Math.sin((i / Math.max(1, count - 1)) * Math.PI) * 42;
        const sy = Math.max(ceilingY + 50, Math.min(state.groundY - 50, startY - arcOffset));
        state.collectibles.push({ type: 'star', x: spawnX + i * 52, y: sy, baseY: sy, radius: 17, phase: i * 0.45 });
      }
    }
  }
}

export function update(dt) {
  if (state.gameState === 'PLAYING' && state.isPaused) {
    return;
  }

  // Sequência cômica de congelamento (~420ms) no impacto
  if (state.gameState === 'IMPACT') {
    audio.updateVehicleHum(false, state.currentAct, false);
    if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 42);
    if (state.sirenFlashTimer > 0) state.sirenFlashTimer = Math.max(0, state.sirenFlashTimer - dt);
    state.dizzyStarAngle += dt * 7.8;
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt * 0.55;
      p.y += p.vy * dt * 0.55;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    state.impactTimer -= dt;
    if (state.impactTimer <= 0) {
      finalizeGameOver();
    }
    return;
  }

  if (state.screenShake > 0) {
    state.screenShake = Math.max(0, state.screenShake - dt * 42);
  }
  if (state.sirenFlashTimer > 0) {
    state.sirenFlashTimer = Math.max(0, state.sirenFlashTimer - dt);
  }
  if (state.transitionFlash > 0) {
    state.transitionFlash = Math.max(0, state.transitionFlash - dt * 2.4);
  }
  if (state.bannerTimer > 0) {
    state.bannerTimer -= dt;
    if (state.bannerTimer <= 0) {
      dom.actBanner.classList.add('hidden');
    }
  }
  if (state.controlHintTimer > 0) {
    state.controlHintTimer -= dt;
    if (state.controlHintTimer <= 0) {
      dom.controlHint.classList.add('hidden');
    }
  }
  if (state.missionToastTimer > 0) {
    state.missionToastTimer -= dt;
    if (state.missionToastTimer <= 0 && dom.missionToast) {
      dom.missionToast.classList.add('hidden');
    }
  }

  // Piscar de olhos e emoções faciais
  player.blinkTimer -= dt;
  if (player.blinkTimer <= -0.11) {
    player.blinkTimer = 2.0 + Math.random() * 2.4;
  }
  if (player.emotionTimer > 0) {
    player.emotionTimer -= dt;
    if (player.emotionTimer <= 0) player.emotionType = 'normal';
  }

  // Recuperação elástica de Squash & Stretch e Suspensão
  player.squashX += (1 - player.squashX) * Math.min(1, dt * 14);
  player.squashY += (1 - player.squashY) * Math.min(1, dt * 14);
  const suspSpring = -player.suspOffset * 130 - player.suspVel * 14;
  player.suspVel += suspSpring * dt;
  player.suspOffset += player.suspVel * dt;

  // Partículas
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.shape === 'dust') p.size += dt * 10;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  // Textos flutuantes
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.life -= dt;
    if (ft.life <= 0) state.floatingTexts.splice(i, 1);
  }

  // Animação ambiente quando em START ou GAMEOVER
  if (state.gameState !== 'PLAYING') {
    audio.updateVehicleHum(false, state.currentAct, false);
    if (state.gameState === 'GAMEOVER') {
      state.dizzyStarAngle += dt * 4.5;
      return;
    }
    state.bgFarOffset = (state.bgFarOffset + 38 * dt) % 1600;
    state.bgMidOffset = (state.bgMidOffset + 78 * dt) % 1200;
    state.groundOffset = (state.groundOffset + 130 * dt) % 90;
    player.runCycle += dt * 11;
    player.wheelAngle += dt * 12;
    player.propAngle += dt * 28;
    player.waveAngle += dt * 6;
    state.pursuerStep += dt * 10;
    for (const c of state.clouds) {
      c.x -= 24 * dt;
      if (c.x < -180) c.x = state.logicalWidth + 140;
    }
    return;
  }

  // -----------------------------------------------------------------------
  // PROGRESSÃO DE DISTÂNCIA, PONTOS, COMBO E RELÓGIO DE 24H
  // -----------------------------------------------------------------------
  if (state.currentAct === 1) {
    const act1Progress = Math.min(1, state.distanceMeters / ACT2_DISTANCE);
    state.currentSpeed = 345 + act1Progress * 75;
  } else if (state.currentAct === 2) {
    const act2Progress = Math.min(1, (state.distanceMeters - ACT2_DISTANCE) / (ACT3_DISTANCE - ACT2_DISTANCE));
    state.currentSpeed = 460 + act2Progress * 95;
  } else {
    const baseDist = state.selectedGameMode === 'classic' ? state.distanceMeters : (state.distanceMeters - ACT3_DISTANCE);
    const act3Progress = Math.min(1, Math.max(0, baseDist) / 1400);
    const turboMult = player.turboTimer > 0 ? 1.55 : 1.0;
    const tailwindMult = state.tailwindTimer > 0 ? 1.22 : 1.0;
    state.currentSpeed = (420 + act3Progress * 280) * turboMult * tailwindMult;
  }

  const deltaMeters = state.currentSpeed * dt * 0.068;
  state.distanceMeters += deltaMeters;
  state.score += deltaMeters * (state.currentAct === 3 ? 3.2 : 2.2);
  trackMissionProgress('run_dist', state.distanceMeters, true);
  trackMissionProgress('run_score', state.score, true);

  if (state.highScore > 0 && !state.beatHighScoreBannerShown && Math.floor(state.score) > state.highScore) {
    state.beatHighScoreBannerShown = true;
    audio.playMilestoneChime();
    spawnExplosion(player.x, player.y - 24, '#facc15', 18);
    addFloatingText(player.x + 20, player.y - 68, '🏆 NOVO RECORDE!', '#fde047');
    if (state.bannerTimer <= 0.25) {
      showActBanner('Recorde Anterior Superado!', '🏆 NOVO RECORDE PESSOAL!');
    }
  }

  if (state.distanceMeters >= state.nextMilestoneDist) {
    const reached = state.nextMilestoneDist;
    state.nextMilestoneDist += 500;
    state.score += 150;
    addRunStars(2);
    trackMissionProgress('stars', 2);
    audio.playMilestoneChime();
    spawnExplosion(player.x, player.y - 24, '#34d399', 14);
    addFloatingText(player.x + 16, player.y - 52, `Marco ${reached}m! +150 (+2★)`, '#6ee7b7');
    if (state.bannerTimer <= 0.25 && (state.selectedGameMode === 'classic' || reached >= 1500)) {
      showActBanner('Bônus +150 pts • +2 ★', `MARCO DE ${reached.toLocaleString('pt-BR')} METROS!`);
    }
  }

  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.comboCount = 0;
    }
  }

  if (state.speechTimer > 0) {
    state.speechTimer = Math.max(0, state.speechTimer - dt);
  }
  state.pursuerVisualGap += (state.pursuerGap - state.pursuerVisualGap) * Math.min(1, dt * 6.5);

  // Relógio de 24h e pressão dos perseguidores nos Atos 1 e 2; Modo Infinito no Ato 3
  if (state.currentAct < 3) {
    const pressure = player.turboTimer > 0 ? -12 : state.clockFreezeTimer > 0 ? 0.35 : (state.clockHours <= 10 ? 1.75 : 0.85);
    adjustPursuerGap(-pressure * dt);
    if (state.pursuerGap <= 0) {
      updateHUD();
      triggerGameOver('Os inimigos da esquerda alcançaram você e cumpriram o mandado!', true, 'pursuit', true);
      return;
    }

    if (state.clockFreezeTimer > 0) {
      state.clockFreezeTimer = Math.max(0, state.clockFreezeTimer - dt);
    } else {
      state.clockHours -= HOURS_PER_SECOND * dt;
      if (state.clockHours <= 0) {
        state.clockHours = 0;
        updateHUD();
        triggerGameOver('Prazo de 24h esgotado! Preso antes de chegar ao aeroporto!', true, 'timeout', false);
        return;
      }
    }
  } else {
    state.endlessFlightSeconds += dt;
  }

  // -----------------------------------------------------------------------
  // TRANSIÇÕES SEM INTERRUPÇÃO ENTRE OS 3 ATOS
  // -----------------------------------------------------------------------
  // Calcula posição para o prop estacionado chegar exatamente em player.x na troca
  if (state.currentAct === 1 && state.distanceMeters >= ACT2_DISTANCE - 38 && !state.transitionProp) {
    const remainingDistPx = (ACT2_DISTANCE - state.distanceMeters) / 0.068;
    state.transitionProp = { kind: 'parked_car', x: Math.max(player.x + 120, player.x + remainingDistPx) };
  }
  if (state.currentAct === 2 && state.distanceMeters >= ACT3_DISTANCE - 48 && !state.transitionProp) {
    const remainingDistPx = (ACT3_DISTANCE - state.distanceMeters) / 0.068;
    state.transitionProp = { kind: 'parked_jet', x: Math.max(player.x + 150, player.x + remainingDistPx) };
  }

  if (state.transitionProp) {
    state.transitionProp.x -= state.currentSpeed * dt;
  }

  // Entrada no Carro aos 450m (Ato 1 -> Ato 2)
  if (state.currentAct === 1 && state.distanceMeters >= ACT2_DISTANCE) {
    state.currentAct = 2;
    state.transitionProp = null;
    state.transitionFlash = 0.75;
    state.obstacles = [];
    player.y = state.groundY;
    player.vy = 0;
    player.jumpsUsed = 0;
    player.isFlipping = false;
    player.flipAngle = 0;
    player.slideTimer = 0;
    player.suspOffset = 7;
    player.invulnTimer = 0.95;
    state.pursuerGap = Math.min(100, Math.max(68, state.pursuerGap + 24));
    state.score += 250;

    audio.setMusicAct(2);
    audio.playCarBoardTransition();
    syncActHUD(2);
    showActBanner('Pegou o Carro! +250 pts', 'ATO 2: RUMO AO AEROPORTO');
    saySpeech('Pisa fundo pro aeroporto!', 2.4);
    showControlHintForAct(2);
    spawnExplosion(player.x, state.groundY - 24, '#38bdf8', 22);
    addFloatingText(player.x + 20, state.groundY - 72, 'Entrou no Carro!', '#fde047');
  }

  // Decolagem no Aeroporto aos 1100m (Ato 2 -> Ato 3)
  if (state.currentAct === 2 && state.distanceMeters >= ACT3_DISTANCE) {
    state.currentAct = 3;
    state.transitionProp = null;
    state.transitionFlash = 0.85;
    state.obstacles = [];
    state.clockFreezeTimer = 0;
    state.tailwindTimer = 0;
    player.y = state.groundY - 38;
    player.vy = -340;
    player.pitch = -0.25;
    player.invulnTimer = 1.15;
    if (upgrades.startShield >= 3 && !player.hasShield) {
      player.hasShield = true;
      addFloatingText(player.x + 18, state.groundY - 112, 'Blindagem Nv3: Escudo!', '#67e8f9');
    }
    state.score += 500;

    audio.setMusicAct(3);
    audio.playTakeoffTransition();
    syncActHUD(3);
    showActBanner('Escapou a Tempo! +500 pts', 'ATO 3: DECOLAGEM • VOO DA FUGA');
    saySpeech('Partiu exterior! Tchau!', 2.6);
    showControlHintForAct(3);
    spawnExplosion(player.x, state.groundY - 30, '#34d399', 26);
    addFloatingText(player.x + 30, state.groundY - 82, 'FUGA AÉREA! Modo Infinito', '#6ee7b7');
  }

  // Atualiza áudio contínuo e temporizadores
  audio.updateVehicleHum(true, state.currentAct, player.turboTimer > 0 || (state.currentAct === 2 && state.isHoldingAction));
  if (player.turboTimer > 0) player.turboTimer = Math.max(0, player.turboTimer - dt);
  if (state.tailwindTimer > 0) state.tailwindTimer = Math.max(0, state.tailwindTimer - dt);
  if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
  if (state.jumpBufferTimer > 0) state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);

  updateHUD();

  // -----------------------------------------------------------------------
  // CENÁRIO EM PARALLAX E SPEED LINES
  // -----------------------------------------------------------------------
  state.bgFarOffset = (state.bgFarOffset + state.currentSpeed * 0.16 * dt) % 1600;
  state.bgMidOffset = (state.bgMidOffset + state.currentSpeed * 0.36 * dt) % 1200;
  state.groundOffset = (state.groundOffset + state.currentSpeed * dt) % 90;
  state.radarAngle += dt * 2.4;
  state.pursuerStep += dt * (state.currentSpeed * 0.046);

  for (const c of state.clouds) {
    c.x -= state.currentSpeed * c.speedFactor * dt;
    if (c.x < -180) {
      c.x = state.logicalWidth + 140;
      c.y = 48 + Math.random() * 270;
    }
  }

  // Linhas de velocidade durante Turbo ou alta velocidade no Ato 2/3
  const wantSpeedLines = player.turboTimer > 0 || state.currentSpeed > 520;
  if (wantSpeedLines && Math.random() < (player.turboTimer > 0 ? 0.55 : 0.22)) {
    state.speedLines.push({
      x: state.logicalWidth + 40,
      y: 40 + Math.random() * (state.groundY - 50),
      len: 55 + Math.random() * 95,
      speed: state.currentSpeed * (player.turboTimer > 0 ? 2.1 : 1.5),
      alpha: player.turboTimer > 0 ? 0.42 : 0.2
    });
  }
  for (let i = state.speedLines.length - 1; i >= 0; i--) {
    const sl = state.speedLines[i];
    sl.x -= sl.speed * dt;
    if (sl.x + sl.len < 0) state.speedLines.splice(i, 1);
  }

  // -----------------------------------------------------------------------
  // FÍSICA DO JOGADOR EM CADA ATO
  // -----------------------------------------------------------------------
  if (state.currentAct === 1) {
    const wasOnGround = player.y >= state.groundY - 1;
    if (wasOnGround) {
      state.coyoteTimer = 0.085;
    } else {
      state.coyoteTimer = Math.max(0, state.coyoteTimer - dt);
    }

    if (player.slideTimer > 0) {
      player.slideTimer = Math.max(0, player.slideTimer - dt);
      if (wasOnGround && Math.random() < 0.35) {
        spawnDust(player.x - 16, state.groundY, 1, 'rgba(203, 213, 225, 0.55)');
      }
    }

    const GRAVITY_RUN = 1900;
    player.vy += GRAVITY_RUN * dt;
    player.y += player.vy * dt;

    if (player.isFlipping) {
      player.flipAngle += dt * (Math.PI * 2 * 1.95);
      if (player.flipAngle >= Math.PI * 2) {
        player.flipAngle = 0;
        player.isFlipping = false;
      }
    }

    if (player.y >= state.groundY) {
      const impacted = !wasOnGround && player.vy > 180;
      player.y = state.groundY;
      player.vy = 0;
      player.jumpsUsed = 0;
      player.isFlipping = false;
      player.flipAngle = 0;
      player.runCycle += dt * (state.currentSpeed * 0.045);

      if (impacted) {
        player.squashX = 1.18;
        player.squashY = 0.82;
        spawnDust(player.x, state.groundY, 6, '#bbf7d0');
      }

      // Poeira sutil dos passos ao correr
      state.dustTimer += dt;
      if (state.dustTimer >= 0.22 && player.slideTimer <= 0) {
        state.dustTimer = 0;
        spawnDust(player.x - 10, state.groundY, 2, 'rgba(187, 247, 208, 0.55)');
      }

      // Executa Jump Buffer se apertou pouco antes do pouso
      if (state.jumpBufferTimer > 0) {
        executeJumpOrHop();
      }
    }
  } else if (state.currentAct === 2) {
    const wasOnGround = player.y >= state.groundY - 1;
    const GRAVITY_CAR = state.isHoldingAction && player.vy < 0 ? 1300 : 1880;
    player.vy += GRAVITY_CAR * dt;
    player.y += player.vy * dt;

    if (player.y >= state.groundY) {
      const impacted = !wasOnGround && player.vy > 180;
      player.y = state.groundY;
      player.vy = 0;
      player.jumpsUsed = 0;
      if (impacted) {
        player.suspOffset = 7.5;
        spawnDust(player.x - 28, state.groundY, 5, 'rgba(203, 213, 225, 0.65)');
        spawnDust(player.x + 28, state.groundY, 4, 'rgba(203, 213, 225, 0.65)');
      }
      if (state.jumpBufferTimer > 0) {
        executeJumpOrHop();
      }
    }
    player.wheelAngle += dt * (state.currentSpeed * 0.048);
    player.pitch = Math.max(-0.22, Math.min(0.22, player.vy * 0.00035));

    // Fumaça do escapamento
    state.trailTimer += dt;
    if (state.trailTimer >= 0.06) {
      state.trailTimer = 0;
      state.particles.push({
        x: player.x - 58,
        y: player.y - 12 + player.suspOffset * 0.4,
        vx: -state.currentSpeed * 0.34,
        vy: -14 + (Math.random() - 0.5) * 14,
        size: 4.5,
        life: 0.3,
        maxLife: 0.3,
        color: state.selectedSkin === 'stealth' ? 'rgba(139, 92, 246, 0.5)' : 'rgba(226, 232, 240, 0.55)',
        shape: 'dust'
      });
    }
  } else {
    // Ato 3: Voo livre no jato executivo (segure para subir, solte para planar)
    const GRAVITY_FLY = 1280;
    const LIFT_FLY = -2760;
    player.vy += (state.isHoldingAction ? LIFT_FLY : GRAVITY_FLY) * dt;
    player.vy = Math.max(-460, Math.min(500, player.vy));
    player.y += player.vy * dt;

    const planeRadius = 24;
    if (player.y < ceilingY + planeRadius) {
      player.y = ceilingY + planeRadius;
      if (player.vy < 0) player.vy = 0;
    }
    if (player.y > state.groundY - planeRadius) {
      if (player.turboTimer > 0 || player.hasShield) {
        player.y = state.groundY - planeRadius;
        player.vy = -320;
        if (player.turboTimer <= 0 && player.hasShield) {
          player.hasShield = false;
          player.invulnTimer = getShieldPostInvuln();
          audio.playShieldBreak();
          spawnExplosion(player.x, state.groundY, '#22d3ee', 18);
          addFloatingText(player.x, player.y - 34, 'Escudo salvou!', '#67e8f9');
        }
      } else {
        player.y = state.groundY - planeRadius;
        triggerGameOver('Pouso forçado após a decolagem!', false, 'ground_crash', true);
        return;
      }
    }

    const targetPitch = Math.max(-0.44, Math.min(0.46, player.vy * 0.00095));
    player.pitch += (targetPitch - player.pitch) * Math.min(1, dt * 13);
    player.propAngle += dt * (player.turboTimer > 0 ? 48 : 30);
    player.waveAngle += dt * (state.isHoldingAction ? 12 : 6.5);

    state.trailTimer += dt;
    if (state.trailTimer >= (player.turboTimer > 0 ? 0.022 : state.tailwindTimer > 0 ? 0.03 : 0.05)) {
      state.trailTimer = 0;
      const trailColor = player.turboTimer > 0
        ? '#facc15'
        : state.tailwindTimer > 0
          ? (Math.random() < 0.5 ? '#34d399' : '#67e8f9')
          : state.selectedSkin === 'gold'
            ? 'rgba(253, 224, 71, 0.7)'
            : state.selectedSkin === 'stealth'
              ? 'rgba(167, 139, 250, 0.6)'
              : 'rgba(255, 255, 255, 0.65)';
      state.particles.push({
        x: player.x - 44,
        y: player.y + 3 + (Math.random() - 0.5) * 6,
        vx: -state.currentSpeed * 0.35,
        vy: (Math.random() - 0.5) * 22,
        size: player.turboTimer > 0 ? 7.5 : state.tailwindTimer > 0 ? 5.6 : 4.2,
        life: 0.28,
        maxLife: 0.28,
        color: trailColor,
        shape: 'dust'
      });
    }
  }

  // -----------------------------------------------------------------------
  // SPAWNERS DE OBSTÁCULOS E COLETÁVEIS (COM COMPENSAÇÃO DE VELOCIDADE)
  // -----------------------------------------------------------------------
  state.obstacleTimer -= dt;
  if (state.obstacleTimer <= 0) {
    spawnObstacle();
    const speedRef = state.currentAct === 1 ? 375 : state.currentAct === 2 ? 500 : 480;
    const speedFactor = Math.max(0.68, speedRef / Math.max(300, state.currentSpeed));
    const baseInterval = (state.currentAct === 1 ? 1.44 : state.currentAct === 2 ? 1.36 : 1.30) * speedFactor;
    state.obstacleTimer = baseInterval + nextRand() * 0.38;
  }

  state.collectibleTimer -= dt;
  if (state.collectibleTimer <= 0) {
    spawnCollectibles();
    state.collectibleTimer = 1.48 + nextRand() * 0.65;
  }

  sendMpTick();
  updateMultiplayerHUD();

  // Hitbox do jogador adaptada ao ato atual e agachamento
  const pBox = getPlayerHitbox();

  // -----------------------------------------------------------------------
  // COLETÁVEIS E POWER-UPS
  // -----------------------------------------------------------------------
  const magnetRadius = getMagnetRadius();
  for (let i = state.collectibles.length - 1; i >= 0; i--) {
    const item = state.collectibles[i];
    item.phase += dt * 4.5;
    item.x -= state.currentSpeed * dt;
    item.y = item.type === 'road_ramp' ? item.baseY : item.baseY + Math.sin(item.phase) * 6;

    if (item.type === 'star' && magnetRadius > 0) {
      const preDist = Math.hypot(pBox.cx - item.x, pBox.cy - item.y);
      if (preDist < magnetRadius && preDist > 1) {
        item.magnetized = true;
        const pullSpeed = Math.max(state.currentSpeed + 260, 560 + upgrades.magnet * 150);
        item.x += ((pBox.cx - item.x) / preDist) * pullSpeed * dt;
        item.baseY += ((pBox.cy - item.y) / preDist) * pullSpeed * dt;
        item.y = item.baseY + Math.sin(item.phase) * 6;
      } else {
        item.magnetized = false;
      }
    }

    const dist = Math.hypot(pBox.cx - item.x, pBox.cy - item.y);
    if (dist < pBox.r + item.radius + 9) {
      if (item.type === 'star') {
        const mult = registerComboHit();
        const pts = 50 * mult;
        state.score += pts;
        addRunStars(1);
        trackMissionProgress('stars', 1);
        adjustPursuerGap(2.8);
        if (state.currentAct === 3) state.distanceMeters += 8;
        audio.playStarPickup();
        spawnExplosion(item.x, item.y, '#facc15', 9);
        addFloatingText(item.x, item.y - 16, mult > 1 ? `+${pts} (x${mult}) +1★` : `+${pts} • +1★`, '#fde047');
      } else if (item.type === 'ring') {
        const mult = registerComboHit();
        const pts = 180 * mult;
        state.score += pts;
        state.distanceMeters += 18;
        addRunStars(3);
        trackMissionProgress('rings', 1);
        player.emotionType = 'smug';
        player.emotionTimer = 0.8;
        audio.playRingPickup();
        spawnExplosion(item.x, item.y, '#34d399', 16);
        addFloatingText(item.x, item.y - 24, `Anel Aéreo! +${pts} (+3★)`, '#6ee7b7');
      } else if (item.type === 'coffee') {
        state.clockFreezeTimer = getCoffeeFreezeDuration();
        state.score += 150;
        adjustPursuerGap(16 + upgrades.coffeeBoost * 3);
        trackMissionProgress('coffee', 1);
        saySpeech('Mais fôlego!', 1.8);
        audio.playCoffeeFreeze();
        spawnExplosion(item.x, item.y, '#22d3ee', 18);
        addFloatingText(item.x, item.y - 22, 'Relógio Congelado! +150', '#67e8f9');
      } else if (item.type === 'shield') {
        player.hasShield = true;
        saySpeech('Tô blindado!', 1.7);
        audio.playPowerupActivate();
        spawnExplosion(item.x, item.y, '#22d3ee', 16);
        addFloatingText(item.x, item.y - 22, 'Escudo de Imunidade!', '#67e8f9');
      } else if (item.type === 'turbo') {
        player.turboTimer = getTurboDuration();
        player.emotionType = 'smug';
        player.emotionTimer = 1.2;
        adjustPursuerGap(25);
        saySpeech('Segura essa poeira!', 1.9);
        audio.playPowerupActivate();
        spawnExplosion(item.x, item.y, '#f59e0b', 18);
        addFloatingText(item.x, item.y - 22, 'Turbo Asa!', '#fde047');
      } else if (item.type === 'road_ramp') {
        player.vy = -610;
        player.jumpsUsed = 1;
        player.invulnTimer = Math.max(player.invulnTimer, 0.35);
        state.score += 120;
        adjustPursuerGap(12);
        saySpeech('Decolando na rampa!', 1.5);
        audio.playRampLaunch();
        triggerHaptic(18);
        spawnExplosion(item.x, item.y, '#f59e0b', 16);
        addFloatingText(item.x, item.y - 26, 'RAMPA! +120', '#fde047');
      } else if (item.type === 'wind_stream') {
        state.tailwindTimer = 2.8;
        state.score += 120;
        saySpeech('Vento a favor!', 1.5);
        audio.playWindGust();
        triggerHaptic(14);
        spawnExplosion(item.x, item.y, '#34d399', 16);
        addFloatingText(item.x, item.y - 24, 'Jato Favorável! +120', '#6ee7b7');
      }
      updateHUD();
      state.collectibles.splice(i, 1);
      continue;
    }

    if (item.x < -80) state.collectibles.splice(i, 1);
  }

  // -----------------------------------------------------------------------
  // OBSTÁCULOS E COLISÕES
  // -----------------------------------------------------------------------
  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const obs = state.obstacles[i];
    let collided = false;
    let hitReason = 'Caminho bloqueado!';

    if (obs.type === 'camera_tripod' || obs.type === 'protest_banner' || obs.type === 'cavalete') {
      obs.x -= state.currentSpeed * dt;
      if (obs.blink !== undefined) obs.blink += dt * 7;

      const ox1 = obs.x - obs.width * 0.36;
      const ox2 = obs.x + obs.width * 0.36;
      const oy1 = obs.y - obs.height + 6;
      const oy2 = obs.y;

      if (pBox.x2 > ox1 && pBox.x1 < ox2 && pBox.y2 > oy1 && pBox.y1 < oy2) {
        collided = true;
        hitReason = obs.type === 'camera_tripod'
          ? 'Cercado pelas câmeras da imprensa no Planalto!'
          : obs.type === 'protest_banner'
            ? 'Bloqueado por uma faixa de protesto!'
            : 'Tropeçou no cavalete da Esplanada!';
      }
      if (obs.x < -120) state.obstacles.splice(i, 1);
    } else if (obs.type === 'press_drone') {
      obs.x -= state.currentSpeed * 1.12 * dt;
      obs.phase += dt * 5.2;
      obs.blink += dt * 10;
      obs.y = obs.baseY + Math.sin(obs.phase) * 5;

      const ox1 = obs.x - obs.width * 0.38;
      const ox2 = obs.x + obs.width * 0.38;
      const oy1 = obs.y - obs.height * 0.5;
      const oy2 = obs.y + obs.height * 0.42;

      if (pBox.x2 > ox1 && pBox.x1 < ox2 && pBox.y2 > oy1 && pBox.y1 < oy2) {
        collided = true;
        hitReason = 'Acertado em cheio por um Drone de Imprensa!';
      }
      if (obs.x < -120) state.obstacles.splice(i, 1);
    } else if (obs.type === 'boom_mic') {
      obs.x -= state.currentSpeed * 1.08 * dt;
      obs.phase += dt * 4.6;
      obs.blink += dt * 9;
      obs.y = obs.baseY + Math.sin(obs.phase) * 4;

      const ox1 = obs.x - obs.width * 0.38;
      const ox2 = obs.x + obs.width * 0.38;
      const oy1 = obs.y - obs.height * 0.5;
      const oy2 = obs.y + obs.height * 0.42;

      if (pBox.x2 > ox1 && pBox.x1 < ox2 && pBox.y2 > oy1 && pBox.y1 < oy2) {
        collided = true;
        hitReason = 'Tropeçou no microfone AO VIVO!';
      }
      if (obs.x < -120) state.obstacles.splice(i, 1);
    } else if (obs.type === 'traffic_cones' || obs.type === 'blitz_block' || obs.type === 'radar_van') {
      obs.x -= state.currentSpeed * dt;
      if (obs.blink !== undefined) obs.blink += dt * (obs.type === 'radar_van' ? 11 : 9);

      const ox1 = obs.x - obs.width * 0.38;
      const ox2 = obs.x + obs.width * 0.38;
      const oy1 = obs.y - obs.height + 6;
      const oy2 = obs.y;

      if (pBox.x2 > ox1 && pBox.x1 < ox2 && pBox.y2 > oy1 && pBox.y1 < oy2) {
        collided = true;
        hitReason = obs.type === 'radar_van'
          ? 'Pego pelo Radar Móvel no Eixo!'
          : obs.type === 'blitz_block'
            ? 'Interceptado por uma blitz no Eixo Monumental!'
            : 'Bateu nos cones de bloqueio rumo ao aeroporto!';
      }
      if (obs.x < -120) state.obstacles.splice(i, 1);
    } else if (obs.type === 'gavel_barrier') {
      obs.x -= state.currentSpeed * 1.24 * dt;
      obs.angle -= dt * 7.5;

      const dist = Math.hypot(pBox.cx - obs.x, pBox.cy - obs.y);
      if (dist < pBox.r + obs.radius * 0.82) {
        collided = true;
        hitReason = 'Atingido por um martelo rolante na pista!';
      }
      if (obs.x < -120) state.obstacles.splice(i, 1);
    } else if (obs.type === 'sky_gavel') {
      obs.x -= state.currentSpeed * dt;
      obs.time += dt;
      obs.angle += obs.spinSpeed * dt;
      obs.y = obs.baseY + Math.sin(obs.time * obs.bobFreq) * obs.bobAmp;

      const dist = Math.hypot(pBox.cx - obs.x, pBox.cy - obs.y);
      if (dist < (pBox.r + obs.radius) * 0.78) {
        collided = true;
        hitReason = 'Atingido por um Martelo da Toga em pleno voo!';
      }
      if (obs.x < -120) state.obstacles.splice(i, 1);
    } else if (obs.type === 'sky_barrier') {
      obs.x -= state.currentSpeed * dt;
      obs.blink += dt * 8;

      const halfW = obs.width * 0.42;
      if (
        pBox.x2 > obs.x - halfW &&
        pBox.x1 < obs.x + halfW &&
        pBox.y2 > obs.y + 4 &&
        pBox.y1 < obs.y + obs.height - 4
      ) {
        collided = true;
        hitReason = 'Interceptado por um Bloqueio Vermelho aéreo!';
      }
      if (obs.x < -120) state.obstacles.splice(i, 1);
    } else if (obs.type === 'sky_dossier') {
      if (obs.warningTimer > 0) {
        obs.warningTimer -= dt;
        obs.y += (player.y - obs.y) * Math.min(1, dt * 2.0);
      } else {
        obs.x -= state.currentSpeed * obs.speedMult * dt;
        obs.tilt = Math.sin(obs.x * 0.025) * 0.1;

        const dx = Math.abs(pBox.cx - obs.x);
        const dy = Math.abs(pBox.cy - obs.y);
        if (dx < obs.width * 0.38 + pBox.r * 0.75 && dy < obs.height * 0.38 + pBox.r * 0.75) {
          collided = true;
          hitReason = 'Atingido por Processos Voadores!';
        }
      }
      if (obs.x < -140) state.obstacles.splice(i, 1);
    } else if (obs.type === 'sky_helicopter') {
      obs.x -= state.currentSpeed * 1.12 * dt;
      obs.time += dt;
      obs.blink += dt * 10;
      obs.y = obs.baseY + Math.sin(obs.time * obs.bobFreq) * obs.bobAmp;

      const dx = Math.abs(pBox.cx - obs.x);
      const dy = Math.abs(pBox.cy - obs.y);
      if (dx < obs.width * 0.40 + pBox.r * 0.75 && dy < obs.height * 0.40 + pBox.r * 0.75) {
        collided = true;
        hitReason = 'Colidiu com o Helicóptero da Imprensa!';
      }
      if (obs.x < -150) state.obstacles.splice(i, 1);
    }

    if (collided) {
      if (player.turboTimer > 0) {
        const turboBonus = 100 + upgrades.turboBoost * 40;
        state.score += turboBonus;
        state.screenShake = 8;
        audio.playShieldBreak();
        spawnExplosion(obs.x, obs.y - 16, '#facc15', 16);
        addFloatingText(pBox.cx + 20, pBox.cy - 26, `+${turboBonus} Turbo!`, '#fde047');
        state.obstacles.splice(i, 1);
      } else if (player.hasShield) {
        player.hasShield = false;
        player.invulnTimer = getShieldPostInvuln();
        player.emotionType = 'shock';
        player.emotionTimer = 0.7;
        state.screenShake = 14;
        updateHUD();
        audio.playShieldBreak();
        triggerHaptic(28);
        spawnExplosion(obs.x, obs.y - 16, '#22d3ee', 22);
        addFloatingText(pBox.cx + 15, pBox.cy - 30, 'Escudo Quebrado!', '#67e8f9');
        state.obstacles.splice(i, 1);
      } else if (player.invulnTimer <= 0) {
        if (state.currentAct < 3 && state.pursuerGap > 34) {
          // Tropeço nos Atos 1 e 2: inimigos avançam com força!
          state.pursuerGap = Math.max(12, state.pursuerGap - 40);
          player.invulnTimer = 1.25;
          player.emotionType = 'shock';
          player.emotionTimer = 0.9;
          state.comboCount = 0;
          state.comboTimer = 0;
          state.screenShake = 15;
          audio.playShieldBreak();
          triggerHaptic(32);
          spawnExplosion(obs.x, obs.y - 16, '#f97316', 18);
          addFloatingText(pBox.cx + 18, pBox.cy - 34, 'Tropeçou! A esquerda colando!', '#fb7185');
          saySpeech('Sai da cola!!', 2.0);
          state.obstacles.splice(i, 1);
          updateHUD();
        } else {
          const arrestReasons = state.currentAct === 1
            ? 'Alcançado pelos militantes da esquerda na saída do Planalto!'
            : state.currentAct === 2
              ? 'Cercado pelo carro de som da esquerda antes do aeroporto!'
              : hitReason;
          triggerGameOver(state.currentAct < 3 ? arrestReasons : hitReason, state.currentAct < 3, obs.type, true);
          return;
        }
      }
    } else if (!obs.nearMissAwarded && obs.x < pBox.cx - 10) {
      // Sistema de Raspão (Near-Miss) com Combo
      const obsCy = obs.type === 'sky_barrier'
        ? obs.y + obs.height * 0.5
        : (obs.type === 'press_drone' || obs.type === 'boom_mic' || obs.type === 'sky_helicopter')
          ? obs.y
          : (obs.y - (obs.height ? obs.height * 0.5 : 0));
      const dy = Math.abs(pBox.cy - obsCy);
      const nearThreshold = (obs.radius || (obs.height ? obs.height * 0.55 : 36)) + pBox.r + 36;
      if (dy <= nearThreshold) {
        obs.nearMissAwarded = true;
        state.nearMissCount += 1;
        trackMissionProgress('near_miss', 1);
        adjustPursuerGap(6.5);
        const mult = registerComboHit();
        const bonus = 75 * mult;
        state.score += bonus;
        player.emotionType = 'shock';
        player.emotionTimer = 0.55;
        audio.playNearMiss();
        spawnExplosion(pBox.cx, pBox.cy, '#38bdf8', 8);
        addFloatingText(pBox.cx + 18, pBox.cy - 36, mult > 1 ? `RASPÃO x${mult}! +${bonus}` : `RASPÃO! +${bonus}`, '#38bdf8');
        updateHUD();
      } else {
        obs.nearMissAwarded = true;
      }
    }
  }
}

export function getPlayerHitbox() {
  if (state.currentAct === 1) {
    if (player.slideTimer > 0) {
      return {
        cx: player.x,
        cy: player.y - 18,
        r: 17,
        x1: player.x - 19,
        x2: player.x + 19,
        y1: player.y - 35,
        y2: player.y - 2
      };
    }
    return {
      cx: player.x,
      cy: player.y - 40,
      r: 23,
      x1: player.x - 15,
      x2: player.x + 15,
      y1: player.y - 78,
      y2: player.y - 2
    };
  } else if (state.currentAct === 2) {
    return {
      cx: player.x,
      cy: player.y - 22,
      r: 26,
      x1: player.x - 48,
      x2: player.x + 48,
      y1: player.y - 42,
      y2: player.y - 2
    };
  }
  return {
    cx: player.x,
    cy: player.y,
    r: 23,
    x1: player.x - 28,
    x2: player.x + 28,
    y1: player.y - 18,
    y2: player.y + 18
  };
}

export function render() {
  ctx.save();
  ctx.scale(state.renderScale, state.renderScale);

  if (state.screenShake > 0.2) {
    ctx.translate(
      (Math.random() - 0.5) * state.screenShake,
      (Math.random() - 0.5) * state.screenShake
    );
  }

  if (state.worldOffsetY > 0) {
    ctx.translate(0, state.worldOffsetY);
  }

  drawBackground();
  drawPursuer();
  drawTransitionProps();
  drawCollectibles();
  drawObstacles();
  drawRemoteRivals();
  drawPlayer();
  drawImpactComedyEffects();
  drawParticlesAndEffects();

  ctx.restore();
}

registerMatchStartHandler(() => startGame(true));

export function gameLoop(timestamp) {
  if (state.lastTimestamp === 0) state.lastTimestamp = timestamp;
  const dt = Math.min((timestamp - state.lastTimestamp) / 1000, 0.05);
  state.lastTimestamp = timestamp;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}
