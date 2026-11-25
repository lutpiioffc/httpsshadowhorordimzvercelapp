/* Generator map prosedural - dipakai server DAN client agar layout identik (seed tetap). */
(function (root) {
  'use strict';
  const CELL = 4, W = 31, H = 31;
  const THEMES = {
    hospital: { name: 'Rumah Sakit Terbengkalai', seed: 101, wall: '#7f8f87', floor: '#4b534f', ceil: '#39413d', fog: 0x040806, fd: 0.07, amb: 0x1b2b24, pat: 'tile', prop: 'bed', style: 'room', door: 0x3a4a44 },
    school:   { name: 'Sekolah Angker', seed: 202, wall: '#8b7b5b', floor: '#3e362b', ceil: '#2b261e', fog: 0x0a0804, fd: 0.07, amb: 0x2a2418, pat: 'plain', prop: 'desk', style: 'room', door: 0x4d3a22 },
    forest:   { name: 'Hutan Gelap', seed: 303, wall: '#1b2a17', floor: '#14230f', ceil: '#000', fog: 0x020503, fd: 0.06, amb: 0x1a2a3a, pat: 'dirt', prop: 'rock', style: 'forest', door: 0x2b1d12 },
    house:    { name: 'Rumah Tua', seed: 404, wall: '#5c4034', floor: '#33231a', ceil: '#26190f', fog: 0x0a0503, fd: 0.08, amb: 0x2a1a14, pat: 'plank', prop: 'cabinet', style: 'room', door: 0x2e1a10 },
    lab:      { name: 'Laboratorium Rahasia', seed: 505, wall: '#8fa3b0', floor: '#2d3741', ceil: '#222a31', fog: 0x03070b, fd: 0.065, amb: 0x1b2f40, pat: 'tile', prop: 'tank', style: 'room', door: 0x44525e }
  };
  function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gen(id) {
    const T = THEMES[id] || THEMES.hospital, r = rng(T.seed);
    const g = [], inRoom = [];
    for (let y = 0; y < H; y++) { g.push(new Array(W).fill(1)); inRoom.push(new Array(W).fill(0)); }
    const rooms = [];
    for (let t = 0; t < 400 && rooms.length < 12; t++) {
      const w = 3 + (r() * 4 | 0), h = 3 + (r() * 4 | 0), x = 1 + (r() * (W - w - 1) | 0), y = 1 + (r() * (H - h - 1) | 0);
      if (rooms.some(o => x < o.x + o.w + 2 && x + w + 2 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y)) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), i: rooms.length });
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { g[j][i] = 0; inRoom[j][i] = 1; }
    }
    const carve = (a, b) => { let x = a.cx, y = a.cy; const sx = Math.sign(b.cx - x), sy = Math.sign(b.cy - y); while (x !== b.cx) { g[y][x] = 0; x += sx; } while (y !== b.cy) { g[y][x] = 0; y += sy; } g[y][x] = 0; };
    const vis = [rooms[0]], left = rooms.slice(1);
    while (left.length) {
      let bi = 0, bj = 0, bd = 1e9;
      for (let i = 0; i < vis.length; i++) for (let j = 0; j < left.length; j++) { const d = Math.abs(vis[i].cx - left[j].cx) + Math.abs(vis[i].cy - left[j].cy); if (d < bd) { bd = d; bi = i; bj = j; } }
      carve(vis[bi], left[bj]); vis.push(left.splice(bj, 1)[0]);
    }
    for (let k = 0; k < 4; k++) carve(rooms[r() * rooms.length | 0], rooms[r() * rooms.length | 0]);
    if (T.style === 'forest') for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (g[y][x] && r() < 0.12) g[y][x] = 0;
    // pintu
    const doors = [], doorIdx = {};
    if (T.style !== 'forest') for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (g[y][x] !== 0 || inRoom[y][x]) continue;
      const l = g[y][x - 1] === 0, rr = g[y][x + 1] === 0, u = g[y - 1][x] === 0, d = g[y + 1][x] === 0;
      let ax = null;
      if (l && rr && !u && !d && (inRoom[y][x - 1] || inRoom[y][x + 1])) ax = 'x';
      else if (u && d && !l && !rr && (inRoom[y - 1][x] || inRoom[y + 1][x])) ax = 'z';
      if (ax && !doors.some(o => Math.abs(o.x - x) + Math.abs(o.y - y) < 3)) { doorIdx[y * W + x] = doors.length; doors.push({ x, y, ax, wx: x * CELL + CELL / 2, wz: y * CELL + CELL / 2 }); }
    }
    const rc = rm => ({ x: (rm.x + rm.w / 2) * CELL, z: (rm.y + rm.h / 2) * CELL });
    const d0 = rm => Math.hypot(rm.cx - rooms[0].cx, rm.cy - rooms[0].cy);
    const byD = rooms.slice(1).sort((a, b) => d0(b) - d0(a));
    const exitR = byD[0];
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = r() * (i + 1) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    const mid = shuffle(rooms.slice(1).filter(x => x !== exitR));
    const jit = rm => { const c = rc(rm); return { x: c.x + (r() - .5) * (rm.w * CELL - 5), z: c.z + (r() - .5) * (rm.h * CELL - 5) }; };
    const items = []; let n = 0;
    const add = (t, rm, extra) => { const p = jit(rm); items.push(Object.assign({ id: 'i' + (n++), t, x: p.x, z: p.z }, extra || {})); };
    for (let i = 0; i < 3; i++) add('key', mid[i % mid.length]);
    add('term', mid[3 % mid.length]);
    for (let i = 0; i < 4; i++) add('note', mid[(4 + i) % mid.length], { idx: i });
    for (let i = 0; i < 6; i++) add('bat', rooms[r() * rooms.length | 0]);
    // properti & loker (di sudut ruangan)
    const props = []; let li = 0;
    rooms.forEach(rm => {
      const cs = shuffle([[0, 0], [1, 0], [0, 1], [1, 1]]);
      const pos = c => ({ x: rm.x * CELL + (c[0] ? rm.w * CELL - 1.2 : 1.2), z: rm.y * CELL + (c[1] ? rm.h * CELL - 1.2 : 1.2) });
      const a = pos(cs[0]); props.push({ id: 'L' + (li++), k: 'locker', x: a.x, z: a.z, r: 0.75 });
      const b = pos(cs[1]); props.push({ id: 'P' + props.length, k: T.prop, x: b.x, z: b.z, r: 0.95 });
    });
    const c0 = rc(rooms[0]);
    const off = [[-2.5, -2], [2.5, -2], [-2.5, 2], [2.5, 2], [0, -2.4], [0, 2.4], [-3.4, 0], [3.4, 0]];
    const spawns = off.map(o => ({ x: c0.x + o[0], z: c0.z + o[1] }));
    return { id, theme: T, W, H, CELL, grid: g, rooms, doors, doorIdx, items, props, spawns, exit: rc(exitR), mons: [rc(byD[1] || exitR), rc(byD[2] || exitR)] };
  }
  const API = { CELL, W, H, THEMES, gen };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Maps = API;
})(typeof window !== 'undefined' ? window : globalThis);
