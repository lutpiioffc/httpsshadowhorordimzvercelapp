'use strict';
/* DIMZ HORROR NIGHT - server multiplayer (Node.js + Socket.IO). Monster AI berjalan di server (otoritatif). */
const http = require('http'), fs = require('fs'), path = require('path');
const { Server } = require('socket.io');
const Maps = require('./maps.js');
const PORT = process.env.PORT || 3000, CELL = Maps.CELL;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml' };
const PUBLIC = new Set(['index.html', 'style.css', 'game.js', 'multiplayer.js', 'maps.js', 'assets', 'models', 'sounds', 'textures']);

const server = http.createServer((req, res) => {
  let u; try { u = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (u === '/health') { res.writeHead(200); return res.end('ok'); }
  if (u === '/') u = '/index.html';
  let f;
  if (u === '/lib/three.min.js') f = path.join(__dirname, 'node_modules', 'three', 'build', 'three.min.js');
  else {
    if (!PUBLIC.has(u.split('/')[1])) { res.writeHead(404); return res.end('Not found'); }
    f = path.join(__dirname, path.normalize(u));
    if (!f.startsWith(__dirname)) { res.writeHead(403); return res.end(); }
  }
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(b);
  });
});
const io = new Server(server, { cors: { origin: '*' } });

const MODES = { survival: { mon: 1, dur: 300, esc: false }, escape: { mon: 1, dur: 0, esc: true }, hide: { mon: 2, dur: 240, esc: false }, solo: { mon: 1, dur: 0, esc: true } };
const MAX = 8, KEYS = 3;
const rooms = {};
const to = (R, e, d) => io.to(R.code).emit(e, d);
const clean = (s, n) => String(s == null ? '' : s).replace(/[<>&"'`]/g, '').trim().slice(0, n);
const num = v => Number.isFinite(v) ? v : 0;
function newCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let c; do { c = ''; for (let i = 0; i < 4; i++) c += a[Math.random() * a.length | 0]; } while (rooms[c]); return c; }
const pub = R => ({ code: R.code, map: R.map, mode: R.mode, host: R.host, state: R.state, players: Object.values(R.players).map(p => ({ id: p.id, nick: p.nick })) });

/* ---------- AI helpers ---------- */
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function los(R, ax, az, bx, bz) {
  const L = R.level, d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = Math.floor((ax + (bx - ax) * t) / CELL), y = Math.floor((az + (bz - az) * t) / CELL);
    if (L.grid[y][x] === 1) return false;
    const di = L.doorIdx[y * L.W + x]; if (di !== undefined && !R.doorOpen[di]) return false;
  }
  return true;
}
function nextCell(L, sx, sy, gx, gy) {
  if (sx === gx && sy === gy) return [gx, gy];
  const W = L.W, s = sy * W + sx, g = gy * W + gx, prev = new Int16Array(W * L.H).fill(-1), q = [s]; prev[s] = s;
  let h = 0, found = false;
  while (h < q.length) {
    const c = q[h++]; if (c === g) { found = true; break; }
    const cx = c % W, cy = (c / W) | 0;
    for (const [dx, dy] of D4) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= L.H || L.grid[ny][nx] === 1) continue; const n = ny * W + nx; if (prev[n] >= 0) continue; prev[n] = c; q.push(n); }
  }
  if (!found) return null;
  let c = g; while (prev[c] !== s) c = prev[c];
  return [c % W, (c / W) | 0];
}
function mkMon(R, i) { const p = R.level.mons[i % 2]; return { x: p.x, z: p.z, ry: 0, st: 0, goal: null, lose: 0, insp: 0 }; }
function pickPatrol(R) { const rm = R.level.rooms[Math.random() * R.level.rooms.length | 0]; return [(rm.x + rm.w / 2) * CELL, (rm.y + rm.h / 2) * CELL]; }

function killPlayer(R, p) {
  p.alive = false; p.hidden = false;
  for (const k in R.lockers) if (R.lockers[k] === p.id) delete R.lockers[k];
  to(R, 'dead', { id: p.id });
}
function aiMon(R, m, dt, alive) {
  const L = R.level;
  let tgt = null, td = 1e9, seen = false;
  for (const p of alive) {
    if (p.hidden) continue;
    const d = Math.hypot(p.x - m.x, p.z - m.z);
    const sv = d < 16 && los(R, m.x, m.z, p.x, p.z);
    const nr = p.mv ? (p.run ? 15 : (p.crouch ? 2.5 : 7)) : 0;
    if ((sv || d < nr) && d < td) { td = d; tgt = p; seen = sv; }
  }
  if (tgt) { m.goal = [tgt.x, tgt.z]; m.st = seen ? 2 : 1; m.lose = 4; }
  else if (m.lose > 0) { m.lose -= dt; if (m.lose <= 0) { m.st = 0; m.goal = null; } }
  if (!m.goal || Math.hypot(m.goal[0] - m.x, m.goal[1] - m.z) < 1.3) { m.st = tgt ? m.st : 0; if (!tgt) m.goal = pickPatrol(R); }
  const spd = m.st === 2 ? 4.4 : m.st === 1 ? 3.3 : 2.1;
  let tx, tz;
  if (seen && tgt) { tx = tgt.x; tz = tgt.z; }
  else {
    const n = nextCell(L, Math.floor(m.x / CELL), Math.floor(m.z / CELL), Math.floor(m.goal[0] / CELL), Math.floor(m.goal[1] / CELL));
    if (!n) { m.goal = null; return; }
    tx = n[0] * CELL + CELL / 2; tz = n[1] * CELL + CELL / 2;
    const di = L.doorIdx[n[1] * L.W + n[0]];
    if (di !== undefined && !R.doorOpen[di]) { R.doorOpen[di] = true; to(R, 'door', { i: di, open: true, m: 1 }); }
  }
  const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz) || 1, st = Math.min(spd * dt, d);
  const nx = m.x + dx / d * st, nz = m.z + dz / d * st;
  const wall = (x, z) => { const gx = Math.floor(x / CELL), gy = Math.floor(z / CELL); return gx < 0 || gy < 0 || gx >= L.W || gy >= L.H || L.grid[gy][gx] === 1; };
  if (!wall(nx, m.z)) m.x = nx; if (!wall(m.x, nz)) m.z = nz;
  m.ry = Math.atan2(dx, dz);
  // menangkap pemain
  let insp = false;
  for (const p of alive) {
    const dd = Math.hypot(p.x - m.x, p.z - m.z);
    if (!p.hidden && dd < 1.4) killPlayer(R, p);
    else if (p.hidden && dd < 2.4) insp = true;
  }
  m.insp = insp ? m.insp + dt : 0;
  if (m.insp > 3.5) { for (const p of alive) if (p.hidden && p.alive && Math.hypot(p.x - m.x, p.z - m.z) < 2.4) killPlayer(R, p); m.insp = 0; }
}
function finish(R, win, reason) {
  R.state = 'end';
  to(R, 'end', { win, reason, time: Math.floor((Date.now() - R.t0) / 1000), escaped: Object.values(R.players).filter(p => p.esc).length });
}
function tick(R, dt) {
  const cfg = MODES[R.mode], now = (Date.now() - R.t0) / 1000, L = R.level;
  const players = Object.values(R.players);
  let alive = players.filter(p => p.alive && !p.esc);
  if (R.mode === 'survival' && R.mons.length < 2 && now > cfg.dur / 2) { R.mons.push(mkMon(R, 1)); to(R, 'msg', 'Sesuatu yang lain telah terbangun...'); }
  for (const m of R.mons) aiMon(R, m, dt, alive.filter(p => p.alive));
  alive = players.filter(p => p.alive && !p.esc);
  if (R.unlocked) for (const p of alive) if (Math.hypot(p.x - L.exit.x, p.z - L.exit.z) < 2.4) { p.esc = true; to(R, 'esc', { id: p.id }); }
  alive = players.filter(p => p.alive && !p.esc);
  if (!alive.length) return finish(R, players.some(p => p.esc), players.some(p => p.esc) ? 'Kamu berhasil kabur!' : 'Semua pemain tewas.');
  if (!cfg.esc && now >= cfg.dur) return finish(R, true, 'Fajar tiba. Kalian selamat!');
  R.tk++;
  if (R.tk % 2 === 0) {
    to(R, 'snap', {
      tl: cfg.esc ? -1 : Math.max(0, Math.ceil(cfg.dur - now)),
      p: players.map(p => [p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.ry.toFixed(2), (p.mv ? 1 : 0) | (p.run ? 2 : 0) | (p.crouch ? 4 : 0) | (p.fl ? 8 : 0) | (p.hidden ? 16 : 0) | (p.alive ? 0 : 32) | (p.esc ? 64 : 0)]),
      m: R.mons.map(m => [+m.x.toFixed(2), +m.z.toFixed(2), +m.ry.toFixed(2), m.st])
    });
  }
}
function prog(R) { to(R, 'prog', { keys: R.keys, need: KEYS, solved: R.solved, unlocked: R.unlocked }); }
function checkUnlock(R) { if (MODES[R.mode].esc && R.solved && R.keys >= KEYS && !R.unlocked) { R.unlocked = true; to(R, 'msg', 'GERBANG KELUAR TERBUKA! Lari ke gerbang!'); } prog(R); }

function startGame(R) {
  const cfg = MODES[R.mode];
  R.level = Maps.gen(R.map); R.state = 'play'; R.t0 = Date.now(); R.tk = 0;
  R.doorOpen = R.level.doors.map(() => false); R.taken = {}; R.lockers = {};
  R.keys = 0; R.solved = false; R.unlocked = false;
  R.code4 = String(1000 + (Math.random() * 9000 | 0));
  R.mons = []; for (let i = 0; i < cfg.mon; i++) R.mons.push(mkMon(R, i));
  Object.values(R.players).forEach((p, i) => { const s = R.level.spawns[i % 8]; Object.assign(p, { x: s.x, z: s.z, ry: 0, alive: true, hidden: false, esc: false, mv: 0, run: 0, crouch: 0, fl: 1 }); });
  to(R, 'start', { map: R.map, mode: R.mode, need: KEYS, dur: cfg.dur, esc: cfg.esc, players: Object.values(R.players).map(p => ({ id: p.id, nick: p.nick, x: p.x, z: p.z })) });
}
function leave(socket) {
  const c = socket.data.code, R = rooms[c]; if (!R) return;
  delete R.players[socket.id]; socket.leave(c); socket.data.code = null;
  for (const k in (R.lockers || {})) if (R.lockers[k] === socket.id) delete R.lockers[k];
  const ids = Object.keys(R.players);
  if (!ids.length) { delete rooms[c]; return; }
  if (R.host === socket.id) R.host = ids[0];
  if (R.state === 'lobby') to(R, 'lobby', pub(R)); else to(R, 'msg', 'Seorang pemain keluar.');
}

io.on('connection', socket => {
  socket.on('create', (d, cb) => {
    d = d || {}; cb = typeof cb === 'function' ? cb : () => { };
    if (socket.data.code) leave(socket);
    const nick = clean(d.nick, 14) || 'Player', map = Maps.THEMES[d.map] ? d.map : 'hospital', mode = MODES[d.mode] ? d.mode : 'survival';
    const code = newCode(), R = rooms[code] = { code, map, mode, host: socket.id, state: 'lobby', players: {} };
    R.players[socket.id] = { id: socket.id, nick, x: 0, z: 0, ry: 0 };
    socket.join(R.code); socket.data.code = R.code;
    cb({ ok: true, id: socket.id }); to(R, 'lobby', pub(R));
  });
  socket.on('join', (d, cb) => {
    d = d || {}; cb = typeof cb === 'function' ? cb : () => { };
    const R = rooms[clean(d.code, 4).toUpperCase()];
    if (!R) return cb({ err: 'Room tidak ditemukan' });
    if (R.state !== 'lobby') return cb({ err: 'Permainan sudah dimulai' });
    if (Object.keys(R.players).length >= (R.mode === 'solo' ? 1 : MAX)) return cb({ err: 'Room penuh' });
    if (socket.data.code) leave(socket);
    R.players[socket.id] = { id: socket.id, nick: clean(d.nick, 14) || 'Player', x: 0, z: 0, ry: 0 };
    socket.join(R.code); socket.data.code = R.code;
    cb({ ok: true, id: socket.id }); to(R, 'lobby', pub(R));
  });
  socket.on('start', () => { const R = rooms[socket.data.code]; if (R && R.host === socket.id && R.state === 'lobby') startGame(R); });
  socket.on('again', () => { const R = rooms[socket.data.code]; if (R && R.host === socket.id && R.state === 'end') { R.state = 'lobby'; to(R, 'lobby', pub(R)); } });
  socket.on('leave', () => leave(socket));
  socket.on('disconnect', () => leave(socket));
  socket.on('st', d => {
    const R = rooms[socket.data.code]; if (!R || R.state !== 'play' || !d) return;
    const p = R.players[socket.id]; if (!p || !p.alive || p.esc || p.hidden) return;
    p.x = Math.max(0, Math.min(Maps.W * CELL, num(d.x))); p.z = Math.max(0, Math.min(Maps.H * CELL, num(d.z))); p.ry = num(d.ry);
    p.mv = d.mv ? 1 : 0; p.run = d.run ? 1 : 0; p.crouch = d.crouch ? 1 : 0; p.fl = d.fl ? 1 : 0;
  });
  socket.on('interact', (d, cb) => {
    cb = typeof cb === 'function' ? cb : () => { };
    const R = rooms[socket.data.code]; if (!R || R.state !== 'play' || !d) return;
    const p = R.players[socket.id]; if (!p || !p.alive || p.esc || p.hidden) return;
    const L = R.level, dist = (x, z) => Math.hypot(p.x - x, p.z - z);
    if (d.k === 'door') {
      const dr = L.doors[d.i | 0]; if (!dr || dist(dr.wx, dr.wz) > 4.4) return;
      const i = d.i | 0;
      if (R.doorOpen[i] && Object.values(R.players).some(q => q.alive && Math.hypot(q.x - dr.wx, q.z - dr.wz) < 2.9)) return to(R, 'msg', 'Ada yang berdiri di pintu!');
      R.doorOpen[i] = !R.doorOpen[i]; to(R, 'door', { i, open: R.doorOpen[i] });
    } else if (d.k === 'item') {
      const it = L.items.find(x => x.id === d.id); if (!it || R.taken[it.id] || dist(it.x, it.z) > 3.6) return;
      if (!MODES[R.mode].esc && it.t !== 'bat') return;
      R.taken[it.id] = 1; to(R, 'item', { id: it.id, by: p.id, nick: p.nick, t: it.t });
      if (it.t === 'key') { R.keys++; checkUnlock(R); }
      if (it.t === 'note') to(R, 'note', { idx: it.idx, digit: R.code4[it.idx] });
    } else if (d.k === 'term') {
      const t = L.items.find(x => x.t === 'term'); if (!t || dist(t.x, t.z) > 3.6 || !MODES[R.mode].esc) return;
      if (String(d.code) === R.code4) { R.solved = true; to(R, 'msg', 'Terminal: kode benar. Akses diberikan.'); checkUnlock(R); }
      else socket.emit('msg', 'Terminal: KODE SALAH');
    }
  });
  socket.on('hide', (d, cb) => {
    cb = typeof cb === 'function' ? cb : () => { };
    const R = rooms[socket.data.code]; if (!R || R.state !== 'play' || !d) return cb({ ok: false });
    const p = R.players[socket.id]; if (!p || !p.alive || p.esc) return cb({ ok: false });
    if (d.on) {
      const lk = R.level.props.find(x => x.id === d.id && x.k === 'locker');
      if (!lk || R.lockers[lk.id] || Math.hypot(p.x - lk.x, p.z - lk.z) > 3.2 || p.hidden) return cb({ ok: false });
      R.lockers[lk.id] = p.id; p.hidden = true; p.x = lk.x; p.z = lk.z; p.lk = lk.id;
    } else { if (!p.hidden) return cb({ ok: true }); delete R.lockers[p.lk]; p.hidden = false; }
    cb({ ok: true }); to(R, 'hide', { id: p.id, on: p.hidden });
  });
  socket.on('chat', t => { const R = rooms[socket.data.code]; const p = R && R.players[socket.id]; if (!p) return; const s = clean(t, 120); if (s) to(R, 'chat', { nick: p.nick, text: s }); });
  socket.on('rtc', d => { const R = rooms[socket.data.code]; if (!R || !d || !R.players[d.to]) return; io.to(d.to).emit('rtc', Object.assign({}, d, { from: socket.id })); });
});

setInterval(() => { for (const c in rooms) { const R = rooms[c]; if (R.state === 'play') { try { tick(R, 0.05); } catch (e) { console.error('tick error', e); } } } }, 50);
server.listen(PORT, () => console.log('DIMZ HORROR NIGHT berjalan di http://localhost:' + PORT));
