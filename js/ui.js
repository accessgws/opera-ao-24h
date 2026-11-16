// =============================================================================
// INTERFACE (HUD, GARAGEM, MISSÕES, ROASTS, GAME OVER E SHARE CARD)
// =============================================================================

import { audio } from './audio.js';
import { UPGRADE_DEFS, IS_COARSE_POINTER, ACT3_DISTANCE, STORAGE_KEY, STORAGE_MUSIC_KEY, STORAGE_TOUCH_MODE_KEY, STORAGE_MUTE_KEY } from './config.js';
import { dom } from './dom.js';
import { syncTouchZoneGuides } from './gameplay.js';
import { drawCaricatureHeadOn } from './render/player.js';
import { drawStar } from './render/utils.js';
import { spawnExplosion } from './render/world.js';
import { state, missionsState, upgrades, player, triggerHaptic } from './state.js';
import { getAvailableUpgradeCount, saveProgressState, getTurboDuration, getCoffeeFreezeDuration } from './storage.js';
import { mpState, sendMpCrash, updateMultiplayerGameOverUI } from './multiplayer.js';
import { monetization, syncGameOverAdUI } from './monetization.js';

export function syncTouchModeUI() {
  const isSplit = state.touchControlMode === 'split';
  if (dom.btnTouchModeText) {
    dom.btnTouchModeText.textContent = isSplit ? '👆 Toque: Dividido' : '👆 Toque: Swipe';
  }
  if (dom.btnPauseTouchModeText) {
    dom.btnPauseTouchModeText.textContent = isSplit
      ? '👆 Toque Celular: Dividido (Esq ↓ / Dir ↑)'
      : '👆 Toque Celular: Swipe (Toque ↑ / Deslize ↓)';
  }
}

export function syncProgressUI() {
  const formattedStars = state.totalStars.toLocaleString('pt-BR');
  if (dom.startTotalStars) dom.startTotalStars.textContent = formattedStars;
  if (dom.garageTotalStars) dom.garageTotalStars.textContent = formattedStars;
  if (dom.hudStarsValue) dom.hudStarsValue.textContent = String(state.runStars);

  const affordable = getAvailableUpgradeCount();
  if (dom.garageBadge) {
    dom.garageBadge.textContent = String(affordable);
    dom.garageBadge.classList.toggle('hidden', affordable <= 0);
  }
  if (dom.gameOverGarageBadge) {
    dom.gameOverGarageBadge.textContent = String(affordable);
    dom.gameOverGarageBadge.classList.toggle('hidden', affordable <= 0);
  }
}

export function showMissionToast(label, reward) {
  if (!dom.missionToast) return;
  dom.missionToastTitle.textContent = label;
  dom.missionToastReward.textContent = `+${reward} ★`;
  dom.missionToast.classList.remove('hidden');
  state.missionToastTimer = 2.8;
}

export function addRunStars(amount) {
  if (amount <= 0) return;
  state.runStars += amount;
  state.totalStars += amount;
  if (dom.hudStarsValue) dom.hudStarsValue.textContent = String(state.runStars);
}

export function trackMissionProgress(type, amount, isRunAbsolute = false) {
  if (state.gameState !== 'PLAYING') return;
  let completedNow = false;
  for (const slot of missionsState.slots) {
    if (slot.done || slot.type !== type) continue;
    const next = isRunAbsolute
      ? Math.max(slot.progress, Math.floor(amount))
      : slot.progress + amount;
    slot.progress = Math.min(slot.target, next);
    if (slot.progress >= slot.target) {
      slot.done = true;
      missionsState.completedCount += 1;
      addRunStars(slot.reward);
      showMissionToast(`Missão: ${slot.label}`, slot.reward);
      audio.playRingPickup();
      completedNow = true;
    }
  }
  if (completedNow) {
    saveProgressState();
    syncProgressUI();
  }
}

export function buildMissionCard(slot) {
  const card = document.createElement('div');
  card.className = slot.done
    ? 'rounded-2xl bg-emerald-500/15 border border-emerald-400/50 p-2.5 flex flex-col justify-between gap-1.5'
    : 'rounded-2xl bg-white/5 border border-white/10 p-2.5 flex flex-col justify-between gap-1.5';

  const topRow = document.createElement('div');
  topRow.className = 'flex items-start justify-between gap-2';

  const title = document.createElement('p');
  title.className = 'text-xs font-bold text-white leading-snug';
  title.textContent = slot.label;

  const rewardPill = document.createElement('span');
  rewardPill.className = slot.done
    ? 'rounded-full bg-emerald-400/25 border border-emerald-300/50 px-2 py-0.5 text-[10px] font-black text-emerald-200 shrink-0'
    : 'rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-black text-amber-200 shrink-0';
  rewardPill.textContent = slot.done ? `✓ +${slot.reward} ★` : `+${slot.reward} ★`;

  topRow.appendChild(title);
  topRow.appendChild(rewardPill);

  const barWrap = document.createElement('div');
  barWrap.className = 'w-full h-1.5 rounded-full bg-slate-900/90 overflow-hidden border border-white/10';
  const barFill = document.createElement('div');
  const pct = Math.min(100, Math.round((slot.progress / Math.max(1, slot.target)) * 100));
  barFill.className = slot.done
    ? 'h-full rounded-full bg-emerald-400 transition-[width] duration-150'
    : 'h-full rounded-full bg-gradient-to-r from-sky-400 to-amber-300 transition-[width] duration-150';
  barFill.style.width = `${pct}%`;
  barWrap.appendChild(barFill);

  const metaRow = document.createElement('div');
  metaRow.className = 'flex items-center justify-between text-[10px] font-bold';
  const scopeText = document.createElement('span');
  scopeText.className = 'text-slate-400';
  scopeText.textContent = slot.done ? 'Concluída!' : (slot.perRun ? 'Em 1 corrida' : 'Acumulativo');
  const progText = document.createElement('span');
  progText.className = slot.done ? 'text-emerald-300 tabular-nums' : 'text-sky-200 tabular-nums';
  progText.textContent = `${Math.floor(slot.progress).toLocaleString('pt-BR')} / ${slot.target.toLocaleString('pt-BR')}`;
  metaRow.appendChild(scopeText);
  metaRow.appendChild(progText);

  card.appendChild(topRow);
  card.appendChild(barWrap);
  card.appendChild(metaRow);
  return card;
}

export function buildUpgradeCard(def) {
  const level = upgrades[def.id] || 0;
  const isMax = level >= 3;
  const cost = isMax ? 0 : def.costs[level];
  const canAfford = !isMax && state.totalStars >= cost;

  const card = document.createElement('div');
  card.className = 'rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col justify-between gap-2.5';

  const header = document.createElement('div');
  header.className = 'flex items-start justify-between gap-2';

  const left = document.createElement('div');
  left.className = 'flex items-center gap-2.5 min-w-0';

  const iconBox = document.createElement('div');
  iconBox.className = 'w-9 h-9 rounded-xl bg-slate-900/80 border border-white/15 flex items-center justify-center text-lg shrink-0';
  iconBox.textContent = def.icon;

  const titleWrap = document.createElement('div');
  titleWrap.className = 'min-w-0';
  const badge = document.createElement('p');
  badge.className = 'text-[9px] font-black uppercase tracking-widest text-amber-300 leading-none';
  badge.textContent = `${def.badge} • Nv ${level}/3`;
  const title = document.createElement('p');
  title.className = 'text-sm font-black text-white leading-tight mt-0.5 truncate';
  title.textContent = def.title;
  titleWrap.appendChild(badge);
  titleWrap.appendChild(title);

  left.appendChild(iconBox);
  left.appendChild(titleWrap);

  const pips = document.createElement('div');
  pips.className = 'flex items-center gap-1 shrink-0 pt-1';
  for (let i = 0; i < 3; i++) {
    const pip = document.createElement('span');
    pip.className = i < level
      ? 'w-3.5 h-1.5 rounded-full bg-emerald-400'
      : 'w-3.5 h-1.5 rounded-full bg-slate-700';
    pips.appendChild(pip);
  }

  header.appendChild(left);
  header.appendChild(pips);

  const desc = document.createElement('p');
  desc.className = 'text-[11px] text-slate-300 leading-snug';
  desc.textContent = def.desc;

  const footer = document.createElement('div');
  footer.className = 'flex items-center justify-between gap-2 pt-1';

  const effectText = document.createElement('span');
  effectText.className = 'text-[10px] font-bold text-sky-200 truncate';
  effectText.textContent = isMax
    ? `Atual: ${def.effects[level]}`
    : `Próx: ${def.effects[level + 1]}`;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.upgradeId = def.id;
  if (isMax) {
    btn.disabled = true;
    btn.className = 'rounded-xl bg-emerald-500/20 border border-emerald-400/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-200 shrink-0';
    btn.textContent = 'Máximo ✓';
  } else if (canAfford) {
    btn.className = 'rounded-xl bg-amber-400 hover:bg-amber-300 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow cursor-pointer active:scale-95 transition shrink-0';
    btn.textContent = `Melhorar • ${cost} ★`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      purchaseUpgrade(def.id);
    });
  } else {
    btn.disabled = true;
    btn.className = 'rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 cursor-not-allowed';
    btn.textContent = `Falta ★ (${cost})`;
  }

  footer.appendChild(effectText);
  footer.appendChild(btn);

  card.appendChild(header);
  card.appendChild(desc);
  card.appendChild(footer);
  return card;
}

export function renderGarage() {
  syncProgressUI();
  if (dom.garageMissionsList) {
    dom.garageMissionsList.textContent = '';
    for (const slot of missionsState.slots) {
      dom.garageMissionsList.appendChild(buildMissionCard(slot));
    }
  }
  if (dom.garageUpgradesList) {
    dom.garageUpgradesList.textContent = '';
    for (const def of UPGRADE_DEFS) {
      dom.garageUpgradesList.appendChild(buildUpgradeCard(def));
    }
  }
}

export function purchaseUpgrade(id) {
  const def = UPGRADE_DEFS.find((d) => d.id === id);
  if (!def) return;
  const level = upgrades[id] || 0;
  if (level >= 3) return;
  const cost = def.costs[level];
  if (state.totalStars < cost) return;

  audio.init();
  state.totalStars -= cost;
  upgrades[id] = level + 1;
  audio.playPowerupActivate();
  saveProgressState();
  renderGarage();
}

export function openGarage() {
  renderGarage();
  if (dom.garageOverlay) dom.garageOverlay.classList.remove('hidden');
}

export function closeGarage() {
  if (dom.garageOverlay) dom.garageOverlay.classList.add('hidden');
  syncProgressUI();
}

export function formatHoursClock(hours) {
  const clamped = Math.max(0, hours);
  const h = Math.floor(clamped);
  const m = Math.floor((clamped - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}h`;
}

export function formatFlightTimer(sec) {
  const s = Math.floor(sec);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function showActBanner(tag, title) {
  dom.actBannerTag.textContent = tag;
  dom.actBannerTitle.textContent = title;
  dom.actBanner.classList.remove('hidden');
  state.bannerTimer = 2.6;
}

export function showControlHintForAct(act) {
  const useTouchHint = state.lastInputWasTouch || IS_COARSE_POINTER;
  if (useTouchHint && state.touchControlMode === 'split' && act < 3) {
    if (dom.controlHint) dom.controlHint.classList.add('hidden');
    state.controlHintTimer = 0;
    return;
  }
  if (act === 1) {
    dom.controlHintText.textContent = useTouchHint
      ? 'Toque: Pulo Duplo  •  Deslize ↓: Agachar'
      : 'Toque / Espaço: Pulo Duplo  •  ↓ / Deslize: Agachar';
  } else if (act === 2) {
    dom.controlHintText.textContent = useTouchHint
      ? 'Toque: Salto Hidráulico  •  Deslize ↓: Aterrissar'
      : 'Toque / Espaço: Salto Hidráulico  •  ↓: Aterrissar Rápido';
  } else {
    dom.controlHintText.textContent = 'Segure: Subir  •  Solte: Planar  •  Passe pelos Anéis!';
  }
  dom.controlHint.classList.remove('hidden');
  state.controlHintTimer = 3.0;
}

export function getComboMultiplier() {
  if (state.comboCount < 2) return 1;
  return Math.min(4, 1 + Math.floor(state.comboCount / 2));
}

export function registerComboHit() {
  state.comboCount += 1;
  state.comboTimer = 3.4;
  if (state.comboCount > state.maxCombo) state.maxCombo = state.comboCount;
  const mult = getComboMultiplier();
  if (mult >= 2) {
    dom.hudComboPill.classList.remove('combo-pop');
    void dom.hudComboPill.offsetWidth;
    dom.hudComboPill.classList.add('combo-pop');
  }
  return mult;
}

export function syncActHUD(act) {
  dom.svgAct1.classList.toggle('hidden', act !== 1);
  dom.svgAct2.classList.toggle('hidden', act !== 2);
  dom.svgAct3.classList.toggle('hidden', act !== 3);

  if (act === 1) {
    dom.hudActLabel.textContent = 'Ato 1 • Planalto';
    dom.hudActLabel.className = 'text-[10px] font-extrabold uppercase tracking-wider text-sky-300 leading-none';
    dom.hudActIconWrap.className = 'w-7 h-7 rounded-xl bg-sky-500/20 border border-sky-400/35 flex items-center justify-center text-sky-300 shrink-0';
  } else if (act === 2) {
    dom.hudActLabel.textContent = 'Ato 2 • Eixo';
    dom.hudActLabel.className = 'text-[10px] font-extrabold uppercase tracking-wider text-amber-300 leading-none';
    dom.hudActIconWrap.className = 'w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-400/35 flex items-center justify-center text-amber-300 shrink-0';
  } else {
    dom.hudActLabel.textContent = 'Ato 3 • Voo';
    dom.hudActLabel.className = 'text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 leading-none';
    dom.hudActIconWrap.className = 'w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/35 flex items-center justify-center text-emerald-300 shrink-0';
  }
  syncTouchZoneGuides();
}

export function updateHUD() {
  dom.hudDistance.textContent = `${Math.floor(state.distanceMeters).toLocaleString('pt-BR')} m`;
  dom.hudScore.textContent = `${Math.floor(state.score).toLocaleString('pt-BR')} pts`;

  // Combo Badge
  const mult = getComboMultiplier();
  if (mult >= 2 && state.comboTimer > 0) {
    dom.hudComboPill.classList.remove('hidden');
    dom.hudComboMult.textContent = `x${mult}`;
  } else {
    dom.hudComboPill.classList.add('hidden');
  }

  // Barra de Progresso até o Aeroporto no modo Campanha + Medidor de Perseguição (Atos 1, 2 e FAB no Ato 3)
  if (state.selectedGameMode === 'campaign' && state.currentAct < 3) {
    dom.hudRouteWrap.classList.remove('hidden');
    const pct = Math.min(100, (state.distanceMeters / ACT3_DISTANCE) * 100);
    dom.hudRouteFill.style.width = `${pct}%`;
  } else {
    dom.hudRouteWrap.classList.add('hidden');
  }

  dom.hudPursuitWrap.classList.remove('hidden');
  const gap = Math.max(0, Math.min(100, state.pursuerGap));
  dom.hudPursuitFill.style.width = `${gap}%`;
  const fabActive = state.currentAct === 3;
  const fabName = state.endlessFlightSeconds >= 50 ? 'GRIPEN!' : state.endlessFlightSeconds >= 22 ? 'F-5M!' : 'Tucano';
  if (gap <= 34) {
    dom.hudPursuitFill.className = 'h-full rounded-full bg-rose-500 animate-pulse transition-[width] duration-100';
    dom.hudPursuitText.textContent = fabActive ? `${fabName} PERIGO` : 'PERIGO!';
    dom.hudPursuitText.className = 'text-rose-400 font-black tabular-nums';
  } else if (gap <= 60) {
    dom.hudPursuitFill.className = 'h-full rounded-full bg-amber-400 transition-[width] duration-100';
    dom.hudPursuitText.textContent = fabActive ? `${fabName} Perto` : 'Perto';
    dom.hudPursuitText.className = 'text-amber-300 tabular-nums';
  } else {
    dom.hudPursuitFill.className = 'h-full rounded-full bg-emerald-400 transition-[width] duration-100';
    dom.hudPursuitText.textContent = fabActive ? `${fabName} Longe` : 'Segura';
    dom.hudPursuitText.className = 'text-emerald-300 tabular-nums';
  }

  // Atualização do Relógio 24h / Modo Infinito Ato 3
  dom.hudClockPill.classList.remove('clock-frozen', 'clock-urgent', 'clock-endless');
  if (state.currentAct === 3) {
    dom.hudClockPill.classList.add('clock-endless');
    dom.svgClockIcon.setAttribute('class', 'w-4 h-4 sm:w-5 sm:h-5 text-emerald-300 shrink-0');
    dom.hudClockSubtitle.textContent = 'Fuga Livre';
    dom.hudClockSubtitle.className = 'text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-emerald-300 leading-none';
    dom.hudClockValue.textContent = formatFlightTimer(state.endlessFlightSeconds);
  } else if (state.clockFreezeTimer > 0) {
    dom.hudClockPill.classList.add('clock-frozen');
    dom.svgClockIcon.setAttribute('class', 'w-4 h-4 sm:w-5 sm:h-5 text-cyan-300 shrink-0');
    dom.hudClockSubtitle.textContent = `Congelado ${state.clockFreezeTimer.toFixed(1)}s`;
    dom.hudClockSubtitle.className = 'text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-cyan-200 leading-none';
    dom.hudClockValue.textContent = formatHoursClock(state.clockHours);
  } else {
    if (state.clockHours <= 5.0) {
      dom.hudClockPill.classList.add('clock-urgent');
      dom.svgClockIcon.setAttribute('class', 'w-4 h-4 sm:w-5 sm:h-5 text-rose-300 shrink-0');
      dom.hudClockSubtitle.textContent = 'Prazo Crítico!';
      dom.hudClockSubtitle.className = 'text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-rose-200 leading-none';
    } else {
      dom.svgClockIcon.setAttribute('class', 'w-4 h-4 sm:w-5 sm:h-5 text-amber-300 shrink-0');
      dom.hudClockSubtitle.textContent = 'Prazo 24h';
      dom.hudClockSubtitle.className = 'text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-slate-300 leading-none';
    }
    dom.hudClockValue.textContent = formatHoursClock(state.clockHours);
  }

  if (dom.hudStarsValue) dom.hudStarsValue.textContent = String(state.runStars);

  // Pilha simultânea de Power-ups ativos (sem ocultar Escudo!)
  if (player.turboTimer > 0) {
    const turboMax = getTurboDuration();
    dom.hudTurboPill.classList.remove('hidden');
    dom.hudTurboTime.textContent = `${player.turboTimer.toFixed(1)}s`;
    dom.hudTurboFill.style.width = `${Math.max(0, Math.min(100, (player.turboTimer / turboMax) * 100))}%`;
  } else {
    dom.hudTurboPill.classList.add('hidden');
  }

  if (state.clockFreezeTimer > 0 && state.currentAct < 3) {
    const coffeeMax = getCoffeeFreezeDuration();
    dom.hudCoffeePill.classList.remove('hidden');
    dom.hudCoffeeTime.textContent = `${state.clockFreezeTimer.toFixed(1)}s`;
    dom.hudCoffeeFill.style.width = `${Math.max(0, Math.min(100, (state.clockFreezeTimer / coffeeMax) * 100))}%`;
  } else {
    dom.hudCoffeePill.classList.add('hidden');
  }

  if (state.tailwindTimer > 0 && state.currentAct === 3 && dom.hudWindPill) {
    dom.hudWindPill.classList.remove('hidden');
    dom.hudWindTime.textContent = `${state.tailwindTimer.toFixed(1)}s`;
    dom.hudWindFill.style.width = `${Math.max(0, Math.min(100, (state.tailwindTimer / 2.8) * 100))}%`;
  } else if (dom.hudWindPill) {
    dom.hudWindPill.classList.add('hidden');
  }

  dom.hudShieldPill.classList.toggle('hidden', !player.hasShield);
}

export function computeFlightRank(dist, pts, obsType) {
  if (dist < 50) return 'Estagiário de Hangar';
  if (dist >= 300) {
    return pts >= 4000 ? 'Asa Intocável (Quase!)' : 'Quase Lenda (Mas Caiu)';
  }
  if (obsType === 'sky_gavel' || obsType === 'gavel_barrier' || obsType === 'sky_dossier' || dist < 160) {
    return 'Imã de Obstáculo';
  }
  return 'Piloto de Fuga';
}

export function buildRoastCatalog(dist, obsType, act, isTimeout) {
  const catalog = [];
  const add = (list) => {
    for (const line of list) {
      if (!catalog.includes(line)) catalog.push(line);
    }
  };

  // 1) Frases específicas por obstáculo derrubador
  if (obsType === 'sky_gavel' || obsType === 'gavel_barrier') {
    add([
      'O Martelo da Toga bateu o ponto bem na sua fuselagem!',
      'Ordem do dia: turbinas lacradas pelo Martelo da Toga!',
      'Tentou voar fora da pauta e tomou martelada de ofício!'
    ]);
  } else if (obsType === 'sky_barrier' || obsType === 'blitz_block') {
    add([
      'O Bloqueio Vermelho tava enorme, brilhando e mesmo assim você foi abraçar!',
      'Ignorou o sinalizador do Bloqueio Vermelho achando que era camarote VIP!',
      'Bloqueio Vermelho x Lataria Executiva: vitória do bloqueio por nocaute!'
    ]);
  } else if (obsType === 'sky_dossier') {
    add([
      'Fugiu do país inteiro, mas um Processo Voador entregou a intimação no ar!',
      'Correios aéreos eficientes: o Processo Voador te achou em altitude de cruzeiro!',
      'Nem o piloto automático desviou dessa pilha de Processos Voadores!'
    ]);
  } else if (obsType === 'ground_crash') {
    add([
      'Esqueceu que o avião precisa subir para continuar voando, comandante!',
      'Decolou com tanta pressa que aterrissou de barriga no Eixo!',
      'Curso rápido de aviação: o chão não é pista de cruzeiro!'
    ]);
  } else if (obsType === 'boom_mic') {
    add([
      'Tomou microfonada ao vivo em cadeia nacional no meio da corrida!',
      'A coletiva não esperava: o microfone boom entrevistou sua testa!',
      'Era só abaixar na entrevista, mas você preferiu dar cabeçada ao vivo!'
    ]);
  } else if (obsType === 'radar_van') {
    add([
      'Passou a 180 km/h no radar móvel — multa gravíssima e carro guinchado!',
      'O radar piscou a foto 3x4 da fuga direto pro boletim de trânsito!',
      'Esqueceu que radar na reta também cobra salto hidráulico!'
    ]);
  } else if (obsType === 'sky_helicopter') {
    add([
      'O helicóptero da TV iluminou sua rota inteira com o holofote!',
      'Tentou disputar espaço aéreo com a reportagem ao vivo e levou fechada!',
      'Plantão urgente: câmera aérea flagrou a barbeiragem no céu!'
    ]);
  } else if (isTimeout || obsType === 'timeout' || obsType === 'pursuit') {
    add([
      'As 24h viraram abóbora e o trio da esquerda chegou pedindo selfie no camburão!',
      'Faltou café no tanque: a militância colou na traseira antes da hora!',
      'Fugiu na marcha lenta e tomou enquadro ao vivo!'
    ]);
  } else {
    add([
      'Tinha uma avenida inteira livre e você mirou certinho no obstáculo!',
      'Seu avião desenvolveu atração magnética por tudo que tá na pista!',
      'A fuga prometia Netflix e terminou em boletim de ocorrência!'
    ]);
  }

  // 2) Frases contextuais pela distância alcançada
  if (dist < 50) {
    add([
      'Caiu com menos de 50m! Nem o cafezinho da torre tinha esfriado ainda!',
      'Estagiário de Hangar certificado: derrapou antes mesmo de engatar a segunda!',
      'Recorde negativo! O motor nem aqueceu e já chamou o guincho!',
      'Se piscar perde a partida — e pelo visto você piscou duas vezes!'
    ]);
  } else if (dist >= 300) {
    add([
      'Já tava mandando cartão-postal internacional e resolveu cair no quintal!',
      'Voou longe feito foguete, só esqueceu de combinar o pouso!',
      'Quase Lenda! Faltou um triz para o asilo vip no Caribe!',
      'Lá na frente a gravidade cobrou a fatura com juros!'
    ]);
  } else {
    add([
      'Pegou embalo bonito, mas beijou o obstáculo em câmera lenta!',
      'Meio caminho andado... pena que a outra metade era parede!',
      'A assessoria confirmou: o plano era ótimo, só faltou desviar!'
    ]);
  }

  return catalog;
}

export function applyCurrentRoastUI() {
  dom.finalRankBadge.textContent = `PATENTE: ${state.currentRankText.toUpperCase()}`;
  dom.finalRoastText.textContent = `"${state.currentRoastText}"`;
}

export function cycleRoast(advance = true) {
  if (!state.roastPool.length) return;
  if (advance) {
    state.currentRoastIndex = (state.currentRoastIndex + 1) % state.roastPool.length;
  }
  state.currentRoastText = state.roastPool[state.currentRoastIndex];
  applyCurrentRoastUI();
}

export function finalizeGameOver() {
  const meta = state.lastImpactMeta || {
    reasonText: 'Interceptado no caminho para o aeroporto.',
    isTimeout: false,
    obsType: 'generic',
    act: state.currentAct,
    dist: state.distanceMeters
  };

  state.gameState = 'GAMEOVER';
  state.isPaused = false;
  state.isHoldingAction = false;
  dom.actBanner.classList.add('hidden');
  dom.controlHint.classList.add('hidden');
  dom.pauseOverlay.classList.add('hidden');
  dom.btnPause.classList.add('hidden');

  const finalScoreInt = Math.floor(state.score);
  const isNewRecord = finalScoreInt > state.highScore && finalScoreInt > 0;
  if (finalScoreInt > state.highScore) {
    state.highScore = finalScoreInt;
    try {
      localStorage.setItem(STORAGE_KEY, String(state.highScore));
    } catch (e) {}
  }

  const actNames = {
    1: 'Ato 1 (Planalto)',
    2: 'Ato 2 (Eixo/Carro)',
    3: 'Ato 3 (Voo da Fuga)'
  };

  state.currentRankText = computeFlightRank(meta.dist, finalScoreInt, meta.obsType);
  state.roastPool = buildRoastCatalog(meta.dist, meta.obsType, meta.act, meta.isTimeout);
  state.currentRoastIndex = 0;
  state.currentRoastText = state.roastPool[0] || 'Hoje não deu, comandante!';
  applyCurrentRoastUI();

  saveProgressState();

  const maxComboMult = state.maxCombo < 2 ? 1 : Math.min(4, 1 + Math.floor(state.maxCombo / 2));
  dom.newRecordBadge.classList.toggle('hidden', !isNewRecord);
  dom.finalStatCombo.textContent = state.maxCombo > 0 ? `x${maxComboMult} (${state.maxCombo})` : 'x1';
  dom.finalStatNearMiss.textContent = String(state.nearMissCount);
  if (dom.finalStatStars) dom.finalStatStars.textContent = `+${state.runStars} ★`;
  syncProgressUI();

  dom.startHighScore.textContent = `${state.highScore.toLocaleString('pt-BR')} pts`;
  dom.finalScore.textContent = `${finalScoreInt.toLocaleString('pt-BR')} pts`;
  dom.finalHighScore.textContent = `${state.highScore.toLocaleString('pt-BR')} pts`;
  dom.finalDistance.textContent = `${Math.floor(meta.dist).toLocaleString('pt-BR')} m`;
  dom.finalAct.textContent = actNames[meta.act] || 'Ato 1';
  dom.gameOverTitle.textContent = meta.isTimeout ? 'PRESO EM FLAGRANTE!' : 'Fim da Operação!';
  dom.gameOverTitle.className = meta.isTimeout
    ? 'text-2xl sm:text-3xl font-black text-rose-400 tracking-tight mb-1'
    : 'text-2xl sm:text-3xl font-black text-white tracking-tight mb-1';
  dom.gameOverReason.textContent = meta.reasonText;

  dom.iconCopy.classList.remove('hidden');
  dom.iconCopied.classList.add('hidden');
  dom.btnCopyText.textContent = 'Copiar Texto';
  dom.btnDownloadCardText.textContent = 'Baixar Card PNG';

  dom.hudLeftGroup.classList.add('hidden');
  dom.hudClockPill.classList.add('hidden');
  dom.hudTurboPill.classList.add('hidden');
  dom.hudCoffeePill.classList.add('hidden');
  if (dom.hudWindPill) dom.hudWindPill.classList.add('hidden');
  dom.hudShieldPill.classList.add('hidden');
  dom.hudComboPill.classList.add('hidden');
  if (dom.hudMpPill) dom.hudMpPill.classList.add('hidden');
  dom.hudLeftSpacer.classList.remove('hidden');
  updateMultiplayerGameOverUI();
  syncGameOverAdUI(mpState.inMatch && mpState.connected);
  monetization.vipTrialActive = false;
  dom.gameOverOverlay.classList.remove('hidden');
  syncTouchZoneGuides();
}

export function triggerGameOver(reasonText, isTimeout = false, obsType = 'generic', withFreeze = true) {
  if (state.gameState === 'GAMEOVER' || state.gameState === 'IMPACT') return;
  sendMpCrash(state.distanceMeters, state.score);
  const comicWords = ['BATEU!', 'CRASH!'];
  state.lastImpactMeta = {
    reasonText,
    isTimeout,
    obsType,
    act: state.currentAct,
    dist: state.distanceMeters,
    comicWord: isTimeout ? 'PRESO!' : comicWords[Math.floor(Math.random() * comicWords.length)]
  };

  state.isPaused = false;
  state.isHoldingAction = false;
  player.emotionType = 'dizzy';
  player.emotionTimer = 999;

  if (isTimeout) {
    state.sirenFlashTimer = 2.8;
    state.screenShake = 12;
    audio.playSirenTimeout();
    triggerHaptic([45, 40, 65]);
  } else {
    state.screenShake = 20;
    audio.playComicCrash();
    triggerHaptic([35, 30, 55]);
    spawnExplosion(player.x, player.y - 20, '#ef4444', 24);
    spawnExplosion(player.x, player.y - 20, '#facc15', 18);
  }

  if (withFreeze && state.gameState === 'PLAYING') {
    // Sequência cômica de congelamento (~420ms) antes de abrir a tela final
    state.gameState = 'IMPACT';
    state.impactTimer = 0.42;
    state.dizzyStarAngle = 0;
    dom.actBanner.classList.add('hidden');
    dom.controlHint.classList.add('hidden');
    dom.btnPause.classList.add('hidden');
    return;
  }

  finalizeGameOver();
}

export function wrapCanvasText(targetCtx, text, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (targetCtx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function generateAndDownloadShareCard() {
  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = 1080;
  cardCanvas.height = 1080;
  const cctx = cardCanvas.getContext('2d');

  // Fundo em gradiente estilo pôster arcade
  const bg = cctx.createLinearGradient(0, 0, 0, 1080);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(0.5, '#0f172a');
  bg.addColorStop(1, '#0369a1');
  cctx.fillStyle = bg;
  cctx.fillRect(0, 0, 1080, 1080);

  // Silhueta do Congresso no rodapé do card
  cctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  cctx.fillRect(0, 910, 1080, 170);
  cctx.fillRect(495, 720, 36, 190);
  cctx.fillRect(545, 720, 36, 190);
  cctx.beginPath();
  cctx.arc(410, 910, 65, Math.PI, 0);
  cctx.fill();
  cctx.beginPath();
  cctx.arc(665, 875, 75, 0, Math.PI);
  cctx.fill();

  // Moldura interna
  cctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  cctx.lineWidth = 6;
  cctx.strokeRect(44, 44, 992, 992);

  // Título
  cctx.fillStyle = '#fde047';
  cctx.font = '900 28px Inter, sans-serif';
  cctx.textAlign = 'center';
  cctx.fillText('RELATÓRIO OFICIAL • MODO ZOAÇÃO NA QUEDA', 540, 108);

  cctx.fillStyle = '#ffffff';
  cctx.font = '900 62px Inter, sans-serif';
  cctx.fillText('VOO DA FUGA', 540, 178);

  // Medalhão com a Caricatura Tonta (espirais + estrelinhas)
  cctx.save();
  cctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
  cctx.strokeStyle = state.selectedSkin === 'gold' ? '#facc15' : state.selectedSkin === 'stealth' ? '#a855f7' : '#38bdf8';
  cctx.lineWidth = 5;
  cctx.beginPath();
  cctx.arc(540, 272, 58, 0, Math.PI * 2);
  cctx.fill();
  cctx.stroke();
  cctx.translate(534, 308);
  drawCaricatureHeadOn(cctx, 1.85, false, state.selectedSkin, true);
  cctx.restore();

  // Estrelinhas em volta do medalhão no card PNG
  for (let si = 0; si < 3; si++) {
    const sx = 472 + si * 68;
    const sy = 212 - (si === 1 ? 14 : 0);
    drawStar(cctx, sx, sy, 5, 11, 5, '#facc15', '#78350f');
  }

  const pts = Math.floor(state.score);
  const rankLabel = (state.currentRankText || computeFlightRank(state.distanceMeters, pts, state.lastImpactMeta?.obsType)).toUpperCase();

  // Selo de Patente
  cctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
  cctx.strokeStyle = '#fbbf24';
  cctx.lineWidth = 3;
  cctx.beginPath();
  cctx.roundRect(210, 344, 660, 46, 23);
  cctx.fill();
  cctx.stroke();

  cctx.fillStyle = '#fde68a';
  cctx.font = '900 25px Inter, sans-serif';
  cctx.textBaseline = 'middle';
  cctx.fillText(`PATENTE: ${rankLabel}`, 540, 367);
  cctx.textBaseline = 'alphabetic';

  // Bloco Central de Pontuação + Zoação Impressa
  cctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  cctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  cctx.lineWidth = 4;
  cctx.beginPath();
  cctx.roundRect(96, 412, 888, 494, 34);
  cctx.fill();
  cctx.stroke();

  cctx.fillStyle = '#94a3b8';
  cctx.font = '700 24px Inter, sans-serif';
  cctx.fillText('PONTUAÇÃO FINAL', 540, 464);

  cctx.fillStyle = '#facc15';
  cctx.font = '900 94px Inter, sans-serif';
  cctx.fillText(`${pts.toLocaleString('pt-BR')} PTS`, 540, 560);

  cctx.fillStyle = '#e2e8f0';
  cctx.font = '800 30px Inter, sans-serif';
  const actLabel = state.selectedGameMode === 'classic' ? 'Modo Voo Clássico' : `Ato ${state.currentAct} Alcançado`;
  cctx.fillText(`Distância: ${Math.floor(state.distanceMeters).toLocaleString('pt-BR')} m   •   ${actLabel}`, 540, 620);

  cctx.fillStyle = '#67e8f9';
  cctx.font = '700 24px Inter, sans-serif';
  cctx.fillText(`Raspões: ${state.nearMissCount}x   •   Combo Máx: ${state.maxCombo}   •   Recorde: ${state.highScore.toLocaleString('pt-BR')}`, 540, 668);

  // Caixa da frase de zoação direto no card PNG
  cctx.fillStyle = 'rgba(225, 29, 72, 0.16)';
  cctx.strokeStyle = 'rgba(251, 113, 133, 0.5)';
  cctx.lineWidth = 3;
  cctx.beginPath();
  cctx.roundRect(136, 700, 808, 172, 22);
  cctx.fill();
  cctx.stroke();

  cctx.fillStyle = '#fda4af';
  cctx.font = '900 20px Inter, sans-serif';
  cctx.fillText('BOLETIM DA ZOAÇÃO:', 540, 738);

  cctx.fillStyle = '#ffffff';
  cctx.font = 'italic 800 29px Inter, sans-serif';
  const roastQuote = `"${state.currentRoastText || 'Hoje não deu, comandante!'}"`;
  const roastLines = wrapCanvasText(cctx, roastQuote, 740).slice(0, 3);
  roastLines.forEach((ln, idx) => {
    cctx.fillText(ln, 540, 782 + idx * 36);
  });

  cctx.fillStyle = '#ffffff';
  cctx.font = '800 30px Inter, sans-serif';
  cctx.fillText('Mande no WhatsApp e desafie a galera!', 540, 972);

  const triggerPngDownload = () => {
    const dataUrl = cardCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `voo-da-fuga-${pts}pts.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    dom.btnDownloadCardText.textContent = 'Card Salvo!';
    setTimeout(() => {
      dom.btnDownloadCardText.textContent = 'Baixar Card PNG';
    }, 2200);
  };

  try {
    if (IS_COARSE_POINTER && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && cardCanvas.toBlob) {
      cardCanvas.toBlob(async (blob) => {
        if (!blob) {
          triggerPngDownload();
          return;
        }
        try {
          const file = new File([blob], `voo-da-fuga-${pts}pts.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'Operação 24h: Voo da Fuga',
              text: `Fiz ${pts.toLocaleString('pt-BR')} pts (${Math.floor(state.distanceMeters).toLocaleString('pt-BR')} m) — Patente: ${state.currentRankText}!`,
              files: [file]
            });
            dom.btnDownloadCardText.textContent = 'Compartilhado!';
            setTimeout(() => {
              dom.btnDownloadCardText.textContent = 'Baixar Card PNG';
            }, 2200);
            return;
          }
        } catch (shareErr) {
          if (shareErr && shareErr.name === 'AbortError') return;
        }
        triggerPngDownload();
      }, 'image/png');
      return;
    }
    triggerPngDownload();
  } catch (err) {}
}

export function toggleMusicPreference() {
  state.musicEnabled = !state.musicEnabled;
  audio.setMusicEnabled(state.musicEnabled);
  try {
    localStorage.setItem(STORAGE_MUSIC_KEY, state.musicEnabled ? '1' : '0');
  } catch (err) {}
}

export function toggleTouchModePreference() {
  state.touchControlMode = state.touchControlMode === 'split' ? 'swipe' : 'split';
  try {
    localStorage.setItem(STORAGE_TOUCH_MODE_KEY, state.touchControlMode);
  } catch (err) {}
  syncTouchModeUI();
  syncTouchZoneGuides();
}

export function toggleMutePreference() {
  audio.init();
  audio.setMuted(!audio.muted);
  try {
    localStorage.setItem(STORAGE_MUTE_KEY, audio.muted ? '1' : '0');
  } catch (err) {}
}
