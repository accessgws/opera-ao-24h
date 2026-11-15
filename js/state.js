// =============================================================================
// ESTADO MUTÁVEL DO JOGO, JOGADOR E CÉU/NUVENS
// =============================================================================

import { IS_COARSE_POINTER, LOGICAL_HEIGHT } from './config.js';

export const state = {
  selectedGameMode: 'campaign', // 'campaign' (V3: 3 Atos) | 'classic' (V1: Voo Direto)
  selectedSkin: 'executivo',    // 'executivo' | 'stealth' | 'gold'
  nearMissCount: 0,
  musicEnabled: true,
  mutedPreference: false,
  touchControlMode: 'split',    // 'split' (Esq: Deslize / Dir: Pulo) | 'swipe' (Toque + Deslize)
  lastInputWasTouch: IS_COARSE_POINTER,
  highScore: 0,

  totalStars: 0,
  runStars: 0,
  missionToastTimer: 0,

  logicalWidth: 1280,
  logicalHeight: LOGICAL_HEIGHT,
  worldOffsetY: 0,
  renderScale: 1,
  groundY: LOGICAL_HEIGHT - 86,

  gameState: 'START', // 'START' | 'PLAYING' | 'IMPACT' | 'GAMEOVER'
  isPaused: false,
  currentAct: 1,      // 1 | 2 | 3
  isHoldingAction: false,
  lastTimestamp: 0,

  impactTimer: 0,
  dizzyStarAngle: 0,
  lastImpactMeta: null,
  roastPool: [],
  currentRoastIndex: 0,
  currentRoastText: '',
  currentRankText: 'Estagiário de Hangar',

  distanceMeters: 0,
  score: 0,
  clockHours: 24.0,
  clockFreezeTimer: 0,
  tailwindTimer: 0,
  nextMilestoneDist: 500,
  beatHighScoreBannerShown: false,
  endlessFlightSeconds: 0,
  currentSpeed: 350,
  screenShake: 0,
  sirenFlashTimer: 0,
  bannerTimer: 0,
  controlHintTimer: 0,
  transitionFlash: 0,

  comboCount: 0,
  comboTimer: 0,
  maxCombo: 0,

  jumpBufferTimer: 0,
  coyoteTimer: 0,
  pointerDownY: 0,
  swipeHandled: false,

  pursuerStep: 0,
  pursuerGap: 62,
  pursuerVisualGap: 62,
  speechText: '',
  speechTimer: 0,

  transitionProp: null, // { kind: 'parked_car' | 'parked_jet', x: number }

  obstacles: [],
  collectibles: [],
  particles: [],
  floatingTexts: [],
  clouds: [],
  nightStars: [],
  speedLines: [],
  bgFarOffset: 0,
  bgMidOffset: 0,
  groundOffset: 0,
  radarAngle: 0,

  obstacleTimer: 1.1,
  collectibleTimer: 0.85,
  trailTimer: 0,
  dustTimer: 0
};

export const upgrades = { magnet: 0, startShield: 0, coffeeBoost: 0, turboBoost: 0 };
export const missionsState = { completedCount: 0, slots: [] };

export const player = {
  x: 240,
  y: LOGICAL_HEIGHT - 86,
  vy: 0,
  runCycle: 0,
  wheelAngle: 0,
  propAngle: 0,
  waveAngle: 0,
  pitch: 0,
  isGrounded: true,
  jumpsUsed: 0,
  isDucking: false,
  duckTimer: 0,
  shieldTimer: 0,
  hasShield: false,
  turboTimer: 0,
  invulnTimer: 0
};

export function triggerHaptic(pattern) {
  if (!state.lastInputWasTouch || !navigator || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(pattern); } catch (e) {}
}

export function saySpeech(text, duration = 2.4) {
  state.speechText = text;
  state.speechTimer = duration;
}

export function adjustPursuerGap(delta) {
  if (state.currentAct >= 3) return;
  state.pursuerGap = Math.max(0, Math.min(100, state.pursuerGap + delta));
}

export function initClouds() {
  state.clouds = [];
  for (let i = 0; i < 9; i++) {
    state.clouds.push({
      x: Math.random() * 1500,
      y: 48 + Math.random() * 270,
      scale: 0.55 + Math.random() * 0.78,
      speedFactor: 0.12 + Math.random() * 0.16,
      alpha: 0.52 + Math.random() * 0.35
    });
  }
}

export function initNightStars() {
  state.nightStars = [];
  for (let i = 0; i < 42; i++) {
    state.nightStars.push({
      x: Math.random() * 1600,
      y: 18 + Math.random() * 340,
      r: 0.9 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2
    });
  }
}
