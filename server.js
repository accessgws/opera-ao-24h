const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;
const DEFAULT_FILE = 'index.html';
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

const server = http.createServer((req, res) => {
  const cleanUrl = (req.url || '/').split('?')[0];
  let decodedPath;
  try {
    decodedPath = cleanUrl === '/' ? DEFAULT_FILE : decodeURIComponent(cleanUrl).replace(/^\/+/, '');
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Bad Request');
  }
  const fullPath = path.resolve(ROOT_DIR, decodedPath);

  const relFromRoot = path.relative(ROOT_DIR, fullPath);
  if (relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

// =============================================================================
// SERVIDOR WEBSOCKET (RFC 6455 EM NODE PURO) PARA MULTIJOGADOR NO MESMO WI-FI
// =============================================================================
const rooms = new Map(); // roomCode -> { mode, status, seed, hostId, clients: Map<id, client> }
let nextClientSeq = 1;

function sendWsFrame(socket, payloadStr, opcode = 0x1) {
  if (!socket || socket.destroyed || !socket.writable) return;
  const payload = Buffer.isBuffer(payloadStr) ? payloadStr : Buffer.from(String(payloadStr), 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  try {
    socket.write(Buffer.concat([header, payload]));
  } catch (e) {}
}

function sendJson(client, obj) {
  sendWsFrame(client.socket, JSON.stringify(obj), 0x1);
}

function broadcastRoom(room, obj, exceptId = null) {
  const msg = JSON.stringify(obj);
  for (const [id, c] of room.clients.entries()) {
    if (exceptId && id === exceptId) continue;
    sendWsFrame(c.socket, msg, 0x1);
  }
}

function emitRoomState(roomCode, room) {
  const players = [];
  for (const c of room.clients.values()) {
    players.push({
      id: c.id,
      name: c.name,
      skin: c.skin,
      alive: c.alive,
      dist: c.dist,
      score: c.score,
    });
  }
  for (const c of room.clients.values()) {
    sendJson(c, {
      type: 'room_state',
      room: roomCode,
      youId: c.id,
      hostId: room.hostId,
      mode: room.mode,
      status: room.status,
      seed: room.seed,
      players,
    });
  }
}

function handleRoomMessage(roomCode, room, client, msg) {
  if (!msg || typeof msg.type !== 'string') return;

  if (msg.type === 'join') {
    client.name = String(msg.name || 'Político').trim().slice(0, 16) || 'Político';
    client.skin = ['executivo', 'stealth', 'gold'].includes(msg.skin) ? msg.skin : 'executivo';
    if (msg.mode && client.id === room.hostId && room.status === 'lobby') {
      room.mode = msg.mode === 'classic' ? 'classic' : 'campaign';
    }
    emitRoomState(roomCode, room);
    return;
  }

  if (msg.type === 'set_skin') {
    client.skin = ['executivo', 'stealth', 'gold'].includes(msg.skin) ? msg.skin : 'executivo';
    emitRoomState(roomCode, room);
    return;
  }

  if (msg.type === 'set_mode' && client.id === room.hostId && room.status === 'lobby') {
    room.mode = msg.mode === 'classic' ? 'classic' : 'campaign';
    emitRoomState(roomCode, room);
    return;
  }

  if (msg.type === 'start_match' && client.id === room.hostId) {
    if (msg.mode === 'classic' || msg.mode === 'campaign') {
      room.mode = msg.mode;
    }
    room.status = 'playing';
    room.seed = (Math.random() * 0xffffffff) >>> 0 || 1337;
    for (const c of room.clients.values()) {
      c.alive = true;
      c.dist = 0;
      c.score = 0;
    }
    broadcastRoom(room, {
      type: 'match_started',
      seed: room.seed,
      mode: room.mode,
      startedAt: Date.now(),
    });
    emitRoomState(roomCode, room);
    return;
  }

  if (msg.type === 'tick') {
    client.dist = Number(msg.dist) || 0;
    client.score = Number(msg.score) || 0;
    client.alive = msg.alive !== false;
    if (['executivo', 'stealth', 'gold'].includes(msg.skin)) {
      client.skin = msg.skin;
    }
    broadcastRoom(room, {
      type: 'rival_tick',
      id: client.id,
      name: client.name,
      skin: client.skin,
      y: Number(msg.y) || 0,
      vy: Number(msg.vy) || 0,
      act: Number(msg.act) || 1,
      dist: client.dist,
      score: client.score,
      alive: client.alive,
      duck: Boolean(msg.duck),
      shield: Boolean(msg.shield),
      turbo: Boolean(msg.turbo),
    }, client.id);
    return;
  }

  if (msg.type === 'crash') {
    client.alive = false;
    client.dist = Number(msg.dist) || client.dist;
    client.score = Number(msg.score) || client.score;
    broadcastRoom(room, {
      type: 'rival_crash',
      id: client.id,
      name: client.name,
      dist: client.dist,
      score: client.score,
    }, client.id);
    const anyAlive = [...room.clients.values()].some((c) => c.alive);
    if (!anyAlive) {
      room.status = 'lobby';
      emitRoomState(roomCode, room);
    }
    return;
  }

  if (msg.type === 'rematch') {
    room.status = 'lobby';
    for (const c of room.clients.values()) {
      c.alive = true;
      c.dist = 0;
      c.score = 0;
    }
    emitRoomState(roomCode, room);
  }
}

server.on('upgrade', (req, socket) => {
  const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (parsed.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const roomCode = (parsed.searchParams.get('room') || 'SALA')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12) || 'SALA';

  let room = rooms.get(roomCode);
  if (!room) {
    room = { mode: 'campaign', status: 'lobby', seed: 1, hostId: null, clients: new Map() };
    rooms.set(roomCode, room);
  }

  const accept = crypto.createHash('sha1').update(key + WS_MAGIC).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  socket.setNoDelay(true);

  if (room.clients.size >= 4) {
    sendWsFrame(socket, JSON.stringify({ type: 'error', message: 'Sala cheia (máximo 4 jogadores).' }), 0x1);
    sendWsFrame(socket, Buffer.alloc(0), 0x8);
    socket.end();
    return;
  }

  const clientId = `p${nextClientSeq++}`;
  const client = {
    id: clientId,
    name: `Jogador ${room.clients.size + 1}`,
    skin: 'executivo',
    alive: true,
    dist: 0,
    score: 0,
    socket,
  };
  room.clients.set(clientId, client);
  if (!room.hostId || !room.clients.has(room.hostId)) {
    room.hostId = clientId;
  }

  let buffer = Buffer.alloc(0);
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    room.clients.delete(clientId);
    if (room.clients.size === 0) {
      rooms.delete(roomCode);
      return;
    }
    if (room.hostId === clientId) {
      room.hostId = room.clients.keys().next().value;
    }
    emitRoomState(roomCode, room);
  };

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const b0 = buffer[0];
      const b1 = buffer[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let payloadLen = b1 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (buffer.length < 4) break;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) break;
        const bigLen = Number(buffer.readBigUInt64BE(2));
        if (bigLen > 1024 * 1024) {
          socket.destroy();
          cleanup();
          return;
        }
        payloadLen = bigLen;
        offset = 10;
      }

      const maskLen = masked ? 4 : 0;
      if (buffer.length < offset + maskLen + payloadLen) break;

      let payload = buffer.subarray(offset + maskLen, offset + maskLen + payloadLen);
      if (masked) {
        const mask = buffer.subarray(offset, offset + 4);
        const unmasked = Buffer.allocUnsafe(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
          unmasked[i] = payload[i] ^ mask[i % 4];
        }
        payload = unmasked;
      }
      buffer = buffer.subarray(offset + maskLen + payloadLen);

      if (opcode === 0x8) {
        sendWsFrame(socket, Buffer.alloc(0), 0x8);
        socket.end();
        cleanup();
        return;
      }
      if (opcode === 0x9) {
        sendWsFrame(socket, payload, 0xA);
        continue;
      }
      if (opcode === 0x1 || opcode === 0x2) {
        try {
          const msg = JSON.parse(payload.toString('utf8'));
          handleRoomMessage(roomCode, room, client, msg);
        } catch (e) {}
      }
    }
  });

  socket.on('close', cleanup);
  socket.on('error', cleanup);
  emitRoomState(roomCode, room);
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`Wi-Fi (mesma rede): http://${net.address}:${PORT}`);
      }
    }
  }
});
