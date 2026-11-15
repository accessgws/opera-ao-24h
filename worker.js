import { DurableObject } from 'cloudflare:workers';

const VALID_SKINS = new Set(['executivo', 'stealth', 'gold']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      const roomCode = (url.searchParams.get('room') || 'SALA')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 12) || 'SALA';

      const id = env.ESCAPE_ROOM.idFromName(roomCode);
      const stub = env.ESCAPE_ROOM.get(id);
      return stub.fetch(request);
    }

    const assetRes = await env.ASSETS.fetch(request);
    if (url.pathname === '/manifest.webmanifest' && assetRes.ok) {
      const headers = new Headers(assetRes.headers);
      headers.set('Content-Type', 'application/manifest+json; charset=utf-8');
      return new Response(assetRes.body, { status: assetRes.status, headers });
    }
    if (url.pathname === '/sw.js' && assetRes.ok) {
      const headers = new Headers(assetRes.headers);
      headers.set('Content-Type', 'application/javascript; charset=utf-8');
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return new Response(assetRes.body, { status: assetRes.status, headers });
    }
    return assetRes;
  }
};

export class EscapeRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  _getRoomMeta() {
    const sockets = this.ctx.getWebSockets();
    let mode = 'campaign';
    let status = 'lobby';
    let seed = 1;
    let hostId = null;

    const players = [];
    for (const ws of sockets) {
      const att = ws.deserializeAttachment() || {};
      if (att.roomMode) mode = att.roomMode;
      if (att.roomStatus) status = att.roomStatus;
      if (att.roomSeed) seed = att.roomSeed;
      if (att.isHost) hostId = att.id;
      players.push({
        id: att.id,
        name: att.name || 'Político',
        skin: att.skin || 'executivo',
        alive: att.alive !== false,
        dist: Number(att.dist) || 0,
        score: Number(att.score) || 0
      });
    }
    if ((!hostId || !players.some((p) => p.id === hostId)) && players.length > 0) {
      hostId = players[0].id;
      const firstWs = sockets[0];
      const att = firstWs.deserializeAttachment() || {};
      att.isHost = true;
      firstWs.serializeAttachment(att);
    }
    return { sockets, mode, status, seed, hostId, players };
  }

  _broadcast(obj, exceptWs = null) {
    const msg = JSON.stringify(obj);
    for (const ws of this.ctx.getWebSockets()) {
      if (exceptWs && ws === exceptWs) continue;
      try { ws.send(msg); } catch (e) {}
    }
  }

  _emitRoomState(roomCode) {
    const meta = this._getRoomMeta();
    for (const ws of meta.sockets) {
      const att = ws.deserializeAttachment() || {};
      try {
        ws.send(JSON.stringify({
          type: 'room_state',
          room: roomCode,
          youId: att.id,
          hostId: meta.hostId,
          mode: meta.mode,
          status: meta.status,
          seed: meta.seed,
          players: meta.players
        }));
      } catch (e) {}
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const roomCode = (url.searchParams.get('room') || 'SALA')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12) || 'SALA';

    const existing = this.ctx.getWebSockets();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (existing.length >= 4) {
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: 'error', message: 'Sala cheia (máximo 4 jogadores).' }));
      server.close(1008, 'Room full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const clientId = `p${crypto.randomUUID().slice(0, 6)}`;
    const prevMeta = this._getRoomMeta();

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      id: clientId,
      roomCode,
      name: `Jogador ${existing.length + 1}`,
      skin: 'executivo',
      alive: true,
      dist: 0,
      score: 0,
      isHost: existing.length === 0,
      roomMode: prevMeta.mode,
      roomStatus: existing.length === 0 ? 'lobby' : prevMeta.status,
      roomSeed: prevMeta.seed
    });

    this._emitRoomState(roomCode);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    let msg;
    try {
      msg = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch (e) {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    const att = ws.deserializeAttachment() || {};
    const roomCode = att.roomCode || 'SALA';
    const meta = this._getRoomMeta();
    const isHost = att.id === meta.hostId;

    if (msg.type === 'join') {
      att.name = String(msg.name || 'Político').trim().slice(0, 16) || 'Político';
      att.skin = VALID_SKINS.has(msg.skin) ? msg.skin : 'executivo';
      if (isHost && meta.status === 'lobby' && (msg.mode === 'classic' || msg.mode === 'campaign')) {
        for (const s of meta.sockets) {
          const sa = s.deserializeAttachment() || {};
          sa.roomMode = msg.mode;
          s.serializeAttachment(sa);
        }
        att.roomMode = msg.mode;
      }
      ws.serializeAttachment(att);
      this._emitRoomState(roomCode);
      return;
    }

    if (msg.type === 'set_skin') {
      att.skin = VALID_SKINS.has(msg.skin) ? msg.skin : 'executivo';
      ws.serializeAttachment(att);
      this._emitRoomState(roomCode);
      return;
    }

    if (msg.type === 'set_mode' && isHost && meta.status === 'lobby') {
      const nextMode = msg.mode === 'classic' ? 'classic' : 'campaign';
      for (const s of meta.sockets) {
        const sa = s.deserializeAttachment() || {};
        sa.roomMode = nextMode;
        s.serializeAttachment(sa);
      }
      this._emitRoomState(roomCode);
      return;
    }

    if (msg.type === 'start_match' && isHost) {
      const nextMode = (msg.mode === 'classic' || msg.mode === 'campaign') ? msg.mode : meta.mode;
      const seed = (Math.random() * 0xffffffff) >>> 0 || 1337;
      for (const s of meta.sockets) {
        const sa = s.deserializeAttachment() || {};
        sa.roomMode = nextMode;
        sa.roomStatus = 'playing';
        sa.roomSeed = seed;
        sa.alive = true;
        sa.dist = 0;
        sa.score = 0;
        s.serializeAttachment(sa);
      }
      this._broadcast({
        type: 'match_started',
        seed,
        mode: nextMode,
        startedAt: Date.now()
      });
      this._emitRoomState(roomCode);
      return;
    }

    if (msg.type === 'tick') {
      att.dist = Number(msg.dist) || 0;
      att.score = Number(msg.score) || 0;
      att.alive = msg.alive !== false;
      if (VALID_SKINS.has(msg.skin)) att.skin = msg.skin;
      ws.serializeAttachment(att);

      this._broadcast({
        type: 'rival_tick',
        id: att.id,
        name: att.name,
        skin: att.skin,
        y: Number(msg.y) || 0,
        vy: Number(msg.vy) || 0,
        act: Number(msg.act) || 1,
        dist: att.dist,
        score: att.score,
        alive: att.alive,
        duck: Boolean(msg.duck),
        shield: Boolean(msg.shield),
        turbo: Boolean(msg.turbo)
      }, ws);
      return;
    }

    if (msg.type === 'crash') {
      att.alive = false;
      att.dist = Number(msg.dist) || att.dist || 0;
      att.score = Number(msg.score) || att.score || 0;
      ws.serializeAttachment(att);

      this._broadcast({
        type: 'rival_crash',
        id: att.id,
        name: att.name,
        dist: att.dist,
        score: att.score
      }, ws);

      const updated = this._getRoomMeta();
      const anyAlive = updated.players.some((p) => p.alive);
      if (!anyAlive) {
        for (const s of updated.sockets) {
          const sa = s.deserializeAttachment() || {};
          sa.roomStatus = 'lobby';
          s.serializeAttachment(sa);
        }
        this._emitRoomState(roomCode);
      }
      return;
    }

    if (msg.type === 'rematch') {
      for (const s of meta.sockets) {
        const sa = s.deserializeAttachment() || {};
        sa.roomStatus = 'lobby';
        sa.alive = true;
        sa.dist = 0;
        sa.score = 0;
        s.serializeAttachment(sa);
      }
      this._emitRoomState(roomCode);
    }
  }

  async webSocketClose(ws) {
    const att = ws.deserializeAttachment() || {};
    const roomCode = att.roomCode || 'SALA';
    const remaining = this.ctx.getWebSockets().filter((s) => s !== ws);
    if (remaining.length > 0) {
      if (att.isHost) {
        const nextAtt = remaining[0].deserializeAttachment() || {};
        nextAtt.isHost = true;
        remaining[0].serializeAttachment(nextAtt);
      }
      this._emitRoomState(roomCode);
    }
  }
}
