// =============================================================================
// MULTIPLAYER EM TEMPO REAL (WEBSOCKET + PRNG DETERMINÍSTICO)
// =============================================================================

import { dom } from './dom.js';
import { state, player } from './state.js';

const MP_NAME_STORAGE_KEY = 'op24h_mp_name_v1';
const TICK_INTERVAL_MS = 50;

export const mpState = {
  connected: false,
  connecting: false,
  inMatch: false,
  roomCode: '',
  youId: '',
  hostId: '',
  mode: 'campaign',
  status: 'lobby', // 'lobby' | 'playing' | 'finished'
  seed: 0,
  prng: null,
  players: [],
  rivals: new Map(), // id -> { id, name, skin, y, vy, act, dist, score, alive, duck, shield, turbo, lastSeen }
  ws: null,
  lastTickSentAt: 0,
  error: ''
};

let onMatchStartHandler = null;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedMatchPrng(seed) {
  const numericSeed = Number(seed) >>> 0;
  mpState.seed = numericSeed;
  mpState.prng = mulberry32(numericSeed || 1);
}

export function nextRand() {
  if (mpState.inMatch && mpState.prng) {
    return mpState.prng();
  }
  return Math.random();
}

export function registerMatchStartHandler(fn) {
  onMatchStartHandler = fn;
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function sanitizeRoomCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function getLocalPlayerName() {
  const raw = dom.mpNameInput ? dom.mpNameInput.value.trim() : '';
  const clean = (raw || 'Candidato').slice(0, 16);
  try {
    localStorage.setItem(MP_NAME_STORAGE_KEY, clean);
  } catch (e) {}
  return clean;
}

function loadSavedName() {
  if (!dom.mpNameInput) return;
  try {
    const saved = localStorage.getItem(MP_NAME_STORAGE_KEY);
    if (saved) dom.mpNameInput.value = saved;
  } catch (e) {}
}

function setConnectError(message) {
  mpState.error = message || '';
  if (!dom.mpConnectError) return;
  if (mpState.error) {
    dom.mpConnectError.textContent = mpState.error;
    dom.mpConnectError.classList.remove('hidden');
  } else {
    dom.mpConnectError.textContent = '';
    dom.mpConnectError.classList.add('hidden');
  }
}

function sendWs(payload) {
  if (!mpState.ws || mpState.ws.readyState !== WebSocket.OPEN) return false;
  try {
    mpState.ws.send(JSON.stringify(payload));
    return true;
  } catch (e) {
    return false;
  }
}

function renderLobbyUI() {
  const inRoom = mpState.connected && Boolean(mpState.roomCode);

  if (dom.mpConnectPanel) {
    dom.mpConnectPanel.classList.toggle('hidden', inRoom);
  }
  if (dom.mpLobbyPanel) {
    dom.mpLobbyPanel.classList.toggle('hidden', !inRoom);
  }
  if (!inRoom) return;

  if (dom.mpRoomCodeBadge) {
    dom.mpRoomCodeBadge.textContent = mpState.roomCode;
  }
  if (dom.mpModeLabel) {
    dom.mpModeLabel.textContent = mpState.mode === 'classic' ? 'V1 · Voo Direto' : 'V3 · 3 Atos';
  }

  const isHost = mpState.youId && mpState.youId === mpState.hostId;
  if (dom.btnMpStartMatch) {
    dom.btnMpStartMatch.disabled = !isHost;
    dom.btnMpStartMatch.classList.toggle('opacity-50', !isHost);
    dom.btnMpStartMatch.classList.toggle('cursor-not-allowed', !isHost);
    dom.btnMpStartMatch.textContent = isHost
      ? (mpState.status === 'playing' ? 'Reiniciar Partida' : 'Iniciar Duelo')
      : 'Aguardando Host...';
  }

  if (dom.mpStatusText) {
    const count = mpState.players.length;
    if (isHost) {
      dom.mpStatusText.textContent = count < 2
        ? 'Compartilhe o código ou link para chamar rivais (ou inicie agora).'
        : `${count} jogadores prontos na sala. Você é o host!`;
    } else {
      dom.mpStatusText.textContent = `${count} jogadores na sala. O host iniciará o duelo.`;
    }
  }

  if (dom.mpPlayersList) {
    dom.mpPlayersList.innerHTML = '';
    const skinBadges = {
      executivo: 'Executivo',
      stealth: 'Stealth',
      gold: 'Ouro'
    };
    mpState.players.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-2 rounded-xl bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs';

      const left = document.createElement('div');
      left.className = 'flex items-center gap-1.5 min-w-0';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'font-bold text-white truncate';
      nameSpan.textContent = p.name || 'Piloto';
      left.appendChild(nameSpan);

      if (p.id === mpState.youId) {
        const youTag = document.createElement('span');
        youTag.className = 'rounded-full bg-sky-500/25 border border-sky-400/40 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-200';
        youTag.textContent = 'Você';
        left.appendChild(youTag);
      }

      if (p.id === mpState.hostId) {
        const hostTag = document.createElement('span');
        hostTag.className = 'rounded-full bg-amber-500/25 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-200';
        hostTag.textContent = 'Host';
        left.appendChild(hostTag);
      }

      const right = document.createElement('span');
      right.className = 'text-[10px] font-bold uppercase tracking-wider text-slate-300 shrink-0';
      right.textContent = skinBadges[p.skin] || 'Executivo';

      row.appendChild(left);
      row.appendChild(right);
      dom.mpPlayersList.appendChild(row);
    });
  }
}

function handleRoomState(msg) {
  mpState.roomCode = msg.room || mpState.roomCode;
  mpState.youId = msg.youId || mpState.youId;
  mpState.hostId = msg.hostId || '';
  mpState.mode = msg.mode || mpState.mode;
  mpState.status = msg.status || 'lobby';
  mpState.players = Array.isArray(msg.players) ? msg.players : [];

  const activeIds = new Set(mpState.players.map((p) => p.id));
  for (const id of mpState.rivals.keys()) {
    if (!activeIds.has(id) || id === mpState.youId) {
      mpState.rivals.delete(id);
    }
  }

  for (const p of mpState.players) {
    if (p.id === mpState.youId) continue;
    const existing = mpState.rivals.get(p.id);
    if (existing) {
      existing.name = p.name || existing.name;
      existing.skin = p.skin || existing.skin;
      if (typeof p.alive === 'boolean') existing.alive = p.alive;
      if (typeof p.dist === 'number' && p.dist > existing.dist) existing.dist = p.dist;
      if (typeof p.score === 'number' && p.score > existing.score) existing.score = p.score;
    } else {
      mpState.rivals.set(p.id, {
        id: p.id,
        name: p.name || 'Rival',
        skin: p.skin || 'executivo',
        y: state.groundY,
        vy: 0,
        act: 1,
        dist: p.dist || 0,
        score: p.score || 0,
        alive: p.alive !== false,
        duck: false,
        shield: false,
        turbo: false,
        lastSeen: performance.now()
      });
    }
  }

  renderLobbyUI();
  updateMultiplayerHUD();
  if (state.gameState === 'GAMEOVER') {
    updateMultiplayerGameOverUI();
  }
}

function handleMatchStarted(msg) {
  mpState.inMatch = true;
  mpState.status = 'playing';
  mpState.mode = msg.mode || mpState.mode;
  seedMatchPrng(msg.seed || Date.now());

  for (const rival of mpState.rivals.values()) {
    rival.y = state.groundY;
    rival.vy = 0;
    rival.act = 1;
    rival.dist = 0;
    rival.score = 0;
    rival.alive = true;
    rival.duck = false;
    rival.shield = false;
    rival.turbo = false;
  }

  closeMultiplayer();
  if (typeof onMatchStartHandler === 'function') {
    onMatchStartHandler(msg);
  }
}

function handleRivalTick(msg) {
  if (!msg.id || msg.id === mpState.youId) return;
  const existing = mpState.rivals.get(msg.id) || {
    id: msg.id,
    name: msg.name || 'Rival',
    skin: msg.skin || 'executivo',
    y: state.groundY,
    vy: 0,
    act: 1,
    dist: 0,
    score: 0,
    alive: true,
    duck: false,
    shield: false,
    turbo: false,
    lastSeen: 0
  };
  existing.name = msg.name || existing.name;
  existing.skin = msg.skin || existing.skin;
  existing.y = typeof msg.y === 'number' ? msg.y : existing.y;
  existing.vy = typeof msg.vy === 'number' ? msg.vy : existing.vy;
  existing.act = typeof msg.act === 'number' ? msg.act : existing.act;
  existing.dist = typeof msg.dist === 'number' ? msg.dist : existing.dist;
  existing.score = typeof msg.score === 'number' ? msg.score : existing.score;
  existing.alive = typeof msg.alive === 'boolean' ? msg.alive : existing.alive;
  existing.duck = Boolean(msg.duck);
  existing.shield = Boolean(msg.shield);
  existing.turbo = Boolean(msg.turbo);
  existing.lastSeen = performance.now();
  mpState.rivals.set(msg.id, existing);
}

function handleRivalCrash(msg) {
  if (!msg.id || msg.id === mpState.youId) return;
  const rival = mpState.rivals.get(msg.id);
  if (rival) {
    rival.alive = false;
    if (typeof msg.dist === 'number') rival.dist = Math.max(rival.dist, msg.dist);
    if (typeof msg.score === 'number') rival.score = Math.max(rival.score, msg.score);
  }
  if (state.gameState === 'GAMEOVER') {
    updateMultiplayerGameOverUI();
  }
}

export function connectToRoom(rawCode) {
  const code = sanitizeRoomCode(rawCode);
  if (code.length < 3) {
    setConnectError('Digite um código com pelo menos 3 caracteres.');
    return;
  }

  leaveRoom(false);
  setConnectError('');
  mpState.connecting = true;
  mpState.roomCode = code;

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${proto}//${location.host}/ws?room=${encodeURIComponent(code)}`;

  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    mpState.connecting = false;
    setConnectError('Não foi possível abrir conexão WebSocket.');
    return;
  }

  mpState.ws = ws;

  ws.addEventListener('open', () => {
    mpState.connected = true;
    mpState.connecting = false;
    setConnectError('');
    sendWs({
      type: 'join',
      name: getLocalPlayerName(),
      skin: state.selectedSkin,
      mode: state.selectedGameMode
    });
    renderLobbyUI();
  });

  ws.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'room_state') handleRoomState(msg);
    else if (msg.type === 'match_started') handleMatchStarted(msg);
    else if (msg.type === 'rival_tick') handleRivalTick(msg);
    else if (msg.type === 'rival_crash') handleRivalCrash(msg);
    else if (msg.type === 'error') {
      setConnectError(msg.message || 'Erro na sala multiplayer.');
    }
  });

  ws.addEventListener('close', () => {
    const wasThisWs = mpState.ws === ws;
    if (!wasThisWs) return;
    mpState.connected = false;
    mpState.connecting = false;
    mpState.ws = null;
    renderLobbyUI();
    updateMultiplayerHUD();
  });

  ws.addEventListener('error', () => {
    if (mpState.ws !== ws) return;
    mpState.connecting = false;
    setConnectError('Falha ao conectar ao servidor da sala.');
  });
}

export function leaveRoom(resetMatchFlag = true) {
  if (mpState.ws) {
    const oldWs = mpState.ws;
    mpState.ws = null;
    try { oldWs.close(); } catch (e) {}
  }
  mpState.connected = false;
  mpState.connecting = false;
  if (resetMatchFlag) mpState.inMatch = false;
  mpState.roomCode = '';
  mpState.youId = '';
  mpState.hostId = '';
  mpState.players = [];
  mpState.rivals.clear();
  setConnectError('');
  renderLobbyUI();
  updateMultiplayerHUD();
}

export function openMultiplayer() {
  loadSavedName();
  setConnectError('');
  renderLobbyUI();
  if (dom.multiplayerOverlay) {
    dom.multiplayerOverlay.classList.remove('hidden');
  }
}

export function closeMultiplayer() {
  if (dom.multiplayerOverlay) {
    dom.multiplayerOverlay.classList.add('hidden');
  }
}

export function requestMpStartMatch() {
  if (!mpState.connected) return false;
  return sendWs({
    type: 'start_match',
    mode: state.selectedGameMode
  });
}

export function sendMpSkin(skin) {
  if (!mpState.connected) return;
  sendWs({ type: 'set_skin', skin });
}

export function sendMpMode(mode) {
  if (!mpState.connected) return;
  mpState.mode = mode;
  sendWs({ type: 'set_mode', mode });
  renderLobbyUI();
}

export function sendMpTick(force = false) {
  if (!mpState.connected || !mpState.inMatch) return;
  const now = performance.now();
  if (!force && now - mpState.lastTickSentAt < TICK_INTERVAL_MS) return;
  mpState.lastTickSentAt = now;

  sendWs({
    type: 'tick',
    y: Math.round(player.y * 10) / 10,
    vy: Math.round(player.vy * 10) / 10,
    act: state.currentAct,
    dist: Math.floor(state.distanceMeters),
    score: Math.floor(state.score),
    alive: state.gameState === 'PLAYING',
    duck: Boolean(player.isDucking),
    shield: Boolean(player.hasShield),
    turbo: player.turboTimer > 0,
    skin: state.selectedSkin
  });
}

export function sendMpCrash(dist = state.distanceMeters, score = state.score) {
  if (!mpState.connected || !mpState.inMatch) return;
  sendWs({
    type: 'crash',
    dist: Math.floor(dist),
    score: Math.floor(score)
  });
  updateMultiplayerGameOverUI();
}

export function requestMpRematch() {
  if (!mpState.connected) return false;
  return sendWs({ type: 'rematch' });
}

function getStandings() {
  const localAlive = state.gameState === 'PLAYING';
  const list = [
    {
      id: mpState.youId || 'local',
      name: getLocalPlayerName(),
      dist: Math.floor(state.distanceMeters),
      score: Math.floor(state.score),
      alive: localAlive,
      isYou: true
    }
  ];
  for (const r of mpState.rivals.values()) {
    list.push({
      id: r.id,
      name: r.name || 'Rival',
      dist: Math.floor(r.dist || 0),
      score: Math.floor(r.score || 0),
      alive: Boolean(r.alive),
      isYou: false
    });
  }
  list.sort((a, b) => (b.dist - a.dist) || (b.score - a.score));
  return list;
}

export function updateMultiplayerHUD() {
  if (!dom.hudMpPill || !dom.hudMpStatus) return;
  const visible = mpState.inMatch && mpState.connected && state.gameState === 'PLAYING';
  dom.hudMpPill.classList.toggle('hidden', !visible);
  if (!visible) return;

  const standings = getStandings();
  const rank = Math.max(1, standings.findIndex((p) => p.isYou) + 1);
  const aliveCount = standings.filter((p) => p.alive).length;
  dom.hudMpStatus.textContent = `${mpState.roomCode} · ${rank}º/${standings.length} (${aliveCount} vivos)`;
}

export function updateMultiplayerGameOverUI() {
  if (!dom.gameOverMpBanner || !dom.gameOverMpList || !dom.gameOverMpHeadline) return;
  const visible = mpState.inMatch && mpState.connected;
  dom.gameOverMpBanner.classList.toggle('hidden', !visible);
  if (!visible) return;

  const standings = getStandings();
  const rank = Math.max(1, standings.findIndex((p) => p.isYou) + 1);
  const anyRivalAlive = standings.some((p) => !p.isYou && p.alive);
  dom.gameOverMpHeadline.textContent = anyRivalAlive
    ? `Sala ${mpState.roomCode} · ${rank}º lugar (rivais voando)`
    : `Sala ${mpState.roomCode} · Resultado: ${rank}º/${standings.length}`;

  dom.gameOverMpList.innerHTML = '';
  standings.forEach((entry, idx) => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-2 text-[11px]';

    const left = document.createElement('span');
    left.className = entry.isYou ? 'font-black text-sky-200 truncate' : 'font-semibold text-slate-200 truncate';
    left.textContent = `${idx + 1}. ${entry.name}${entry.isYou ? ' (Você)' : ''}`;

    const right = document.createElement('span');
    right.className = 'font-mono text-[10px] shrink-0 ' + (entry.alive ? 'text-emerald-300' : 'text-slate-400');
    right.textContent = `${entry.dist}m · ${entry.alive ? 'VOANDO' : 'CAIU'}`;

    row.appendChild(left);
    row.appendChild(right);
    dom.gameOverMpList.appendChild(row);
  });
}

export function initMultiplayerFromUrl() {
  loadSavedName();
  const params = new URLSearchParams(location.search);
  const room = sanitizeRoomCode(params.get('sala') || params.get('room'));
  if (room.length >= 3) {
    if (dom.mpRoomCodeInput) dom.mpRoomCodeInput.value = room;
    openMultiplayer();
    connectToRoom(room);
  }
}
