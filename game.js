'use strict';
/* DIMZ HORROR NIGHT - client game (Three.js). Grafis & suara dibuat prosedural. */
(function () {
  const $ = id => document.getElementById(id);
  const CELL = Maps.CELL, isTouch = matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window);
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angLerp = (a, b, t) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
  if (isTouch) document.body.classList.add('touch');

  /* ================= AUDIO (prosedural WebAudio) ================= */
  const A = {
    ctx: null,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
        const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.noise = b;
        [41, 43.5, 82.7].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f; g.gain.value = i === 2 ? 0.012 : 0.06; o.connect(g); g.connect(this.master); o.start(); });
        this.mon = [0, 1].map(() => {
          const p = c.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 3; p.rolloffFactor = 1.3; p.connect(this.master);
          const g = c.createGain(); g.gain.value = 0; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
          const o1 = c.createOscillator(), o2 = c.createOscillator(); o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 52; o2.frequency.value = 55.5;
          const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5; lg.gain.value = 14; lfo.connect(lg); lg.connect(o1.frequency); lfo.start();
          o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(p); o1.start(); o2.start();
          return { p, g };
        });
      } catch (e) { console.warn('audio', e); this.ctx = null; }
    },
    setPos(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); },
    pan(x, z) { const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 1.6; this.setPos(p, x, 1, z); p.connect(this.master); return p; },
    listen(x, y, z, yaw) {
      if (!this.ctx) return; const L = this.ctx.listener, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      if (L.positionX) { L.positionX.value = x; L.positionY.value = y; L.positionZ.value = z; L.forwardX.value = fx; L.forwardY.value = 0; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
      else { L.setPosition(x, y, z); L.setOrientation(fx, 0, fz, 0, 1, 0); }
    },
    burst(dur, freq, vol, x, z) {
      if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = c.createGain(), t = c.currentTime;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f); f.connect(g); g.connect(x === undefined ? this.master : this.pan(x, z)); s.start(t, Math.random() * 0.5, dur + 0.05);
    },
    tone(f1, f2, dur, vol, type, x, z) {
      if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
      o.type = type || 'sine'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(x === undefined ? this.master : this.pan(x, z)); o.start(t); o.stop(t + dur + 0.05);
    },
    step(vol, x, z, heavy) { this.burst(heavy ? 0.28 : 0.13, heavy ? 220 : 520, vol, x, z); if (heavy) this.tone(70, 35, 0.25, vol * 0.8, 'sine', x, z); },
    creak(x, z) { this.tone(80, 150, 0.7, 0.12, 'sawtooth', x, z); this.burst(0.5, 700, 0.15, x, z); },
    pick() { this.tone(660, 990, 0.15, 0.2, 'triangle'); },
    roar() { this.tone(160, 50, 1.3, 0.5, 'sawtooth'); this.tone(240, 80, 1.1, 0.3, 'square'); this.burst(1.2, 1800, 0.45); },
    heart() { this.tone(62, 38, 0.16, 0.7, 'sine'); setTimeout(() => this.tone(55, 35, 0.14, 0.45, 'sine'), 170); },
    scare() { this.burst(1.4, 6000, 0.9); this.tone(900, 120, 1.2, 0.5, 'sawtooth'); this.tone(930, 130, 1.2, 0.5, 'sawtooth'); },
    amb(px, pz) { const a = Math.random() * 6.28, r = 12 + Math.random() * 15; if (Math.random() < .5) this.burst(0.7, 380, 0.5, px + Math.cos(a) * r, pz + Math.sin(a) * r); else this.creak(px + Math.cos(a) * r, pz + Math.sin(a) * r); }
  };

  /* ================= THREE.JS ================= */
  const canvas = $('gl');
  const R = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 1.75));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(75, 1, 0.1, 70);
  cam.rotation.order = 'YXZ'; scene.add(cam);
  function resize() { R.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  const fl = new THREE.SpotLight(0xfff0cc, 0, 36, 0.5, 0.6, 1.5); fl.position.set(0.12, -0.1, 0); cam.add(fl);
  const flT = new THREE.Object3D(); flT.position.set(0, 0, -6); cam.add(flT); fl.target = flT;
  const amb = new THREE.AmbientLight(0x222233, 0.45); scene.add(amb);
  scene.background = new THREE.Color(0x000000); scene.fog = new THREE.FogExp2(0x000000, 0.08);

  function tex(base, pat) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { const v = Math.random() < .5; x.fillStyle = v ? 'rgba(255,255,255,' + Math.random() * .06 + ')' : 'rgba(0,0,0,' + Math.random() * .18 + ')'; x.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 4, 1 + Math.random() * 4); }
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2;
    if (pat === 'tile') { for (let i = 0; i <= 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); } }
    else if (pat === 'plank') { for (let i = 0; i <= 128; i += 21) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); } }
    for (let i = 0; i < 6; i++) { const gx = Math.random() * 128, gy = Math.random() * 128, g = x.createRadialGradient(gx, gy, 2, gx, gy, 12 + Math.random() * 22); g.addColorStop(0, Math.random() < .25 ? 'rgba(90,0,0,.45)' : 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0 }, o));
  const glowM = (hex) => new THREE.MeshBasicMaterial({ color: hex, fog: false });

  function disposeGroup(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); }

  function makeProp(k) {
    const g = new THREE.Group();
    if (k === 'locker') { g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), std({ color: 0x2a3430, roughness: .6, metalness: .4 }))); g.children[0].position.y = 1.1; for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(.6, .04, .02), std({ color: 0x000000 })); s.position.set(0, 1.7 + i * .1, .51); g.add(s); } }
    else if (k === 'bed') { const b = new THREE.Mesh(new THREE.BoxGeometry(1.0, .5, 2.0), std({ color: 0x8a8f8c })); b.position.y = .45; g.add(b); const p = new THREE.Mesh(new THREE.BoxGeometry(.7, .15, .4), std({ color: 0xb0aaa0 })); p.position.set(0, .78, -.7); g.add(p); const l = new THREE.Mesh(new THREE.BoxGeometry(.9, .2, 1.2), std({ color: 0x5a0a0a })); l.position.set(0, .72, .35); g.add(l); }
    else if (k === 'desk') { const t = new THREE.Mesh(new THREE.BoxGeometry(1.3, .1, .8), std({ color: 0x6b4c2a })); t.position.y = .8; g.add(t); [[-.55, -.3], [.55, -.3], [-.55, .3], [.55, .3]].forEach(p => { const l = new THREE.Mesh(new THREE.BoxGeometry(.07, .8, .07), std({ color: 0x222222 })); l.position.set(p[0], .4, p[1]); g.add(l); }); }
    else if (k === 'cabinet') { const c = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, .6), std({ color: 0x3b2417 })); c.position.y = 1.05; g.add(c); }
    else if (k === 'tank') { const c = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, 2.3, 12), new THREE.MeshStandardMaterial({ color: 0x66ffaa, emissive: 0x22aa55, emissiveIntensity: .8, transparent: true, opacity: .6 })); c.position.y = 1.15; g.add(c); }
    else { const c = new THREE.Mesh(new THREE.DodecahedronGeometry(.9, 0), std({ color: 0x3a3d3a })); c.position.y = .6; c.scale.set(1, .7, 1.1); g.add(c); }
    return g;
  }
  function makeItem(it) {
    const g = new THREE.Group();
    if (it.t === 'key') { const m = new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0xaa7700, emissiveIntensity: 1 }); const r = new THREE.Mesh(new THREE.TorusGeometry(.14, .04, 8, 14), m), s = new THREE.Mesh(new THREE.BoxGeometry(.05, .34, .05), m); s.position.y = -.25; const t = new THREE.Mesh(new THREE.BoxGeometry(.14, .05, .05), m); t.position.set(.07, -.34, 0); g.add(r, s, t); g.userData.h = 1.1; }
    else if (it.t === 'bat') { g.add(new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .35, 10), new THREE.MeshStandardMaterial({ color: 0x33dd44, emissive: 0x118822, emissiveIntensity: 1 }))); g.userData.h = .9; }
    else if (it.t === 'note') { const p = new THREE.Mesh(new THREE.BoxGeometry(.45, .02, .6), new THREE.MeshStandardMaterial({ color: 0xe8e0c0, emissive: 0x555040, emissiveIntensity: .6 })); g.add(p); g.userData.h = .9; }
    else { const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, .7), std({ color: 0x1c2226, metalness: .5, roughness: .4 })); b.position.y = .8; const s = new THREE.Mesh(new THREE.BoxGeometry(.9, .55, .05), glowM(0x22ff66)); s.position.set(0, 1.25, .36); g.add(b, s); g.userData.h = 0; }
    g.position.set(it.x, g.userData.h, it.z); g.userData.it = it; return g;
  }

  let L = null, LG = null, LV = null; // level data, group, view objects
  function buildLevel(map, esc) {
    if (LG) { scene.remove(LG); disposeGroup(LG); }
    L = Maps.gen(map); const T = L.theme; LG = new THREE.Group(); scene.add(LG);
    scene.background.setHex(T.fog); scene.fog.color.setHex(T.fog); scene.fog.density = T.fd; amb.color.setHex(T.amb);
    const forest = T.style === 'forest', W = L.W, H = L.H, cells = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (L.grid[y][x] === 1) {
      let near = false; for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1; i++) { const yy = y + j, xx = x + i; if (yy >= 0 && xx >= 0 && yy < H && xx < W && L.grid[yy][xx] === 0) { near = true; break; } }
      if (near) cells.push([x, y]);
    }
    const d = new THREE.Object3D();
    if (forest) {
      const tm = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.3, 1.7, 9, 8), std({ color: 0x2b1d12, roughness: 1 }), cells.length);
      const fm = new THREE.InstancedMesh(new THREE.ConeGeometry(3.4, 6, 7), std({ color: 0x0c2410, roughness: 1 }), cells.length);
      cells.forEach(([x, y], i) => { const s = .9 + Math.random() * .25; d.position.set(x * CELL + 2, 4.5, y * CELL + 2); d.scale.set(s, 1, s); d.rotation.y = Math.random() * 6; d.updateMatrix(); tm.setMatrixAt(i, d.matrix); d.position.y = 10; d.updateMatrix(); fm.setMatrixAt(i, d.matrix); });
      LG.add(tm, fm);
    } else {
      const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 3.4, CELL), std({ map: tex(T.wall, T.pat), roughness: .95 }), cells.length);
      cells.forEach(([x, y], i) => { d.position.set(x * CELL + 2, 1.7, y * CELL + 2); d.scale.set(1, 1, 1); d.rotation.y = 0; d.updateMatrix(); wm.setMatrixAt(i, d.matrix); });
      LG.add(wm);
      const ct = tex(T.ceil, 'plain'); ct.repeat.set(W * 1.2, H * 1.2);
      const ce = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), std({ map: ct })); ce.rotation.x = Math.PI / 2; ce.position.set(W * CELL / 2, 3.4, H * CELL / 2); LG.add(ce);
    }
    const ft = tex(T.floor, T.pat); ft.repeat.set(W * 1.5, H * 1.5);
    const fl2 = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), std({ map: ft, roughness: 1 })); fl2.rotation.x = -Math.PI / 2; fl2.position.set(W * CELL / 2, 0, H * CELL / 2); LG.add(fl2);
    const doorM = std({ color: T.door, roughness: .8 });
    const doors = L.doors.map(dr => { const m = new THREE.Mesh(dr.ax === 'x' ? new THREE.BoxGeometry(.25, 3.1, CELL - .15) : new THREE.BoxGeometry(CELL - .15, 3.1, .25), doorM); m.position.set(dr.wx, 1.55, dr.wz); m.userData.o = 0; LG.add(m); return m; });
    L.props.forEach(p => { const m = makeProp(p.k); m.position.set(p.x, 0, p.z); m.rotation.y = Math.random() * 3; if (p.k === 'locker') m.rotation.y = 0; LG.add(m); });
    const items = {};
    L.items.forEach(it => { if (!esc && it.t !== 'bat') return; const m = makeItem(it); LG.add(m); items[it.id] = m; });
    let gate = null;
    if (esc) {
      gate = new THREE.Group(); const gm = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1111, emissiveIntensity: 1.2 });
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(.5, 3.2, .5), gm), p2 = p1.clone(), tp = new THREE.Mesh(new THREE.BoxGeometry(3.4, .5, .5), gm);
      p1.position.set(-1.5, 1.6, 0); p2.position.set(1.5, 1.6, 0); tp.position.set(0, 3.1, 0);
      const veil = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.8), new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: .25, side: THREE.DoubleSide, fog: false })); veil.position.y = 1.5;
      gate.add(p1, p2, tp, veil); gate.position.set(L.exit.x, 0, L.exit.z); gate.userData.mat = gm; gate.userData.veil = veil; LG.add(gate);
    }
    return { doors, items, gate };
  }

  /* ---------- Model monster & pemain ---------- */
  function makeMonster() {
    const g = new THREE.Group(), skin = std({ color: 0x9a9488, roughness: .9 }), dark = std({ color: 0x120e0e, roughness: 1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.5, .4), dark); body.position.y = 2.0; g.add(body);
    const ribs = new THREE.Mesh(new THREE.BoxGeometry(.5, 1.0, .42), skin); ribs.position.set(0, 2.2, 0); ribs.scale.set(1, 1, .8); g.add(ribs);
    const headG = new THREE.Group(); headG.position.set(0, 3.05, .06); g.add(headG);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 10), skin); head.scale.set(.8, 1.6, .9); headG.add(head);
    [-.1, .1].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), glowM(0xff0000)); e.position.set(x, .12, .22); headG.add(e); });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(.2, .12, .05), glowM(0x550000)); mouth.position.set(0, -.18, .23); headG.add(mouth);
    const mk = (x, y, len, w, mat) => { const p = new THREE.Group(); p.position.set(x, y, 0); const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat); m.position.y = -len / 2; p.add(m); g.add(p); return p; };
    const aL = mk(-.5, 2.7, 1.9, .1, skin), aR = mk(.5, 2.7, 1.9, .1, skin), lL = mk(-.2, 1.3, 1.3, .15, dark), lR = mk(.2, 1.3, 1.3, .15, dark);
    const lt = new THREE.PointLight(0xff1010, 0, 12, 2); lt.position.y = 2.5; g.add(lt);
    g.userData = { aL, aR, lL, lR, headG, lt, body };
    return g;
  }
  function makeNameTag(name) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.font = 'bold 34px Courier New'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.shadowColor = '#000'; x.shadowBlur = 6; x.fillText(name, 128, 44);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, fog: false })); s.scale.set(2, .5, 1); s.position.y = 2.1; s.renderOrder = 10; return s;
  }
  function makePlayer(id, nick) {
    const g = new THREE.Group(), h = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    const col = new THREE.Color().setHSL(h / 360, .55, .45);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.28, .3, 1.1, 10), std({ color: col })); body.position.y = .75; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.2, 10, 8), std({ color: 0xd9b99b })); head.position.y = 1.5; g.add(head);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(.9, 4, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: .09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.rotation.x = -Math.PI / 2; beam.position.set(0, 1.3, -2.1); g.add(beam);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 6), glowM(0xfff2c0)); lamp.position.set(.2, 1.2, -.3); g.add(lamp);
    g.add(makeNameTag(nick)); g.userData = { body, beam, lamp };
    return g;
  }

  /* ================= STATE ================= */
  let G = null; const me = { id: null, nick: '' }; let room = null;
  const P = { x: 0, z: 0, px: 0, pz: 0, yaw: 0, pitch: 0, stam: 100, bat: 100, fl: true, crouch: false, run: false, hidden: false, alive: true, esc: false, eye: 1.65, bob: 0, stepT: 0, exh: false, mv: false, lock: null };
  const keys = {}, joy = { x: 0, y: 0 }; let touchRun = false, panelOpen = false, chatOpen = false;
  const MODE_NAME = { survival: 'Survival', escape: 'Escape', hide: 'Hide & Seek', solo: 'Solo' };
  const screens = ['menu', 'lobby', 'ready', 'end'];
  const show = id => screens.forEach(s => $(s).classList.toggle('active', s === id));
  let toastT = 0;
  function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600); }
  function addChat(nick, text, sys) {
    const d = document.createElement('div'); if (sys) { d.className = 'sys'; d.textContent = text; } else { const b = document.createElement('b'); b.textContent = nick + ': '; d.appendChild(b); d.appendChild(document.createTextNode(text)); }
    const l = $('clog'); l.appendChild(d); while (l.children.length > 40) l.removeChild(l.firstChild); l.scrollTop = 1e6; setTimeout(() => d.classList.add('old'), 9000);
  }
  const sys = t => addChat('', t, true);
  const inRoom = on => { $('chat').classList.toggle('show', on); $('side').classList.toggle('show', on); };

  /* ================= INPUT ================= */
  const applyLook = (dx, dy) => { if (!G || !G.running || panelOpen || !P.alive || P.esc) return; P.yaw -= dx; P.pitch = clamp(P.pitch - dy, -1.35, 1.35); };
  document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) applyLook(e.movementX * 0.0022, e.movementY * 0.0022); });
  document.addEventListener('pointerlockchange', () => { const l = document.pointerLockElement === canvas; if (!l && G && G.running && !G.over && !isTouch && !panelOpen && !chatOpen) $('resume').classList.add('active'); else $('resume').classList.remove('active'); });
  $('resume').addEventListener('click', () => canvas.requestPointerLock());
  $('lookzone').addEventListener('click', () => { if (!isTouch && G && G.running && !panelOpen && !chatOpen && document.pointerLockElement !== canvas) canvas.requestPointerLock(); });
  function bind(el, fn) { el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false }); el.addEventListener('mousedown', e => { if (!isTouch) fn(); }); }
  // joystick
  const joyEl = $('joy'), knob = $('knob'); let joyId = null, jc = { x: 0, y: 0 };
  function joyMove(t) { let dx = t.clientX - jc.x, dy = t.clientY - jc.y; const m = Math.hypot(dx, dy), r = 50; if (m > r) { dx *= r / m; dy *= r / m; } joy.x = dx / r; joy.y = dy / r; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
  function joyEnd() { joyId = null; joy.x = joy.y = 0; knob.style.transform = ''; }
  joyEl.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; joyId = t.identifier; const r = joyEl.getBoundingClientRect(); jc.x = r.left + r.width / 2; jc.y = r.top + r.height / 2; joyMove(t); }, { passive: false });
  joyEl.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === joyId) joyMove(t); }, { passive: false });
  ['touchend', 'touchcancel'].forEach(n => joyEl.addEventListener(n, e => { for (const t of e.changedTouches) if (t.identifier === joyId) joyEnd(); }));
  // geser layar = kamera
  const lz = $('lookzone'); let lookId = null, lx = 0, ly = 0;
  lz.addEventListener('touchstart', e => { e.preventDefault(); for (const t of e.changedTouches) if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; } }, { passive: false });
  lz.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === lookId) { applyLook((t.clientX - lx) * 0.0055, (t.clientY - ly) * 0.0055); lx = t.clientX; ly = t.clientY; } }, { passive: false });
  ['touchend', 'touchcancel'].forEach(n => lz.addEventListener(n, e => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; }));
  document.addEventListener('touchmove', e => { if (G && G.running && !panelOpen && !chatOpen && !(e.target.tagName === 'INPUT')) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());

  const canAct = () => G && G.running && P.alive && !P.esc && !panelOpen && !chatOpen;
  function toggleFl() { if (!canAct() || P.hidden) return; if (P.bat <= 0) return toast('Baterai habis!'); P.fl = !P.fl; A.tone(1200, 900, .05, .1, 'square'); }
  function toggleCrouch() { if (canAct() && !P.hidden) P.crouch = !P.crouch; }
  function nearLocker() { let b = null, bd = 2.7; for (const p of L.props) if (p.k === 'locker') { const d = Math.hypot(P.x - p.x, P.z - p.z); if (d < bd) { bd = d; b = p; } } return b; }
  function hideAct() {
    if (!canAct()) return;
    if (P.hidden) { Net.emit('hide', { on: false }, r => { if (r && r.ok) { P.hidden = false; P.x = P.px; P.z = P.pz; } }); return; }
    const lk = nearLocker(); if (!lk) return toast('Tidak ada loker di dekatmu');
    Net.emit('hide', { on: true, id: lk.id }, r => { if (r && r.ok) { P.px = P.x; P.pz = P.z; P.x = lk.x; P.z = lk.z; P.hidden = true; P.lock = lk; } else toast('Loker tidak tersedia'); });
  }
  function findTarget() {
    let best = null, bd = 1e9; const cand = (kind, id, x, z, r, label) => { const d = Math.hypot(P.x - x, P.z - z); if (d < r && d < bd) { bd = d; best = { kind, id, label }; } };
    L.doors.forEach((d, i) => cand('door', i, d.wx, d.wz, 3.1, G.doorOpen[i] ? 'Tutup pintu' : 'Buka pintu'));
    for (const m of Object.values(LV.items)) { const it = m.userData.it; if (it.t === 'term') cand('term', 0, it.x, it.z, 2.8, 'Gunakan terminal'); else cand('item', it.id, it.x, it.z, 2.4, it.t === 'key' ? 'Ambil kunci' : it.t === 'bat' ? 'Ambil baterai' : 'Baca catatan'); }
    return best;
  }
  function act() {
    if (!canAct() || P.hidden) return; const t = findTarget(); if (!t) return;
    if (t.kind === 'term') return openTerm();
    if (t.kind === 'door') Net.emit('interact', { k: 'door', i: t.id }); else Net.emit('interact', { k: 'item', id: t.id });
  }
  function openTerm() { panelOpen = true; if (document.pointerLockElement) document.exitPointerLock(); $('cdigits').textContent = 'Catatan: ' + G.digits.map(d => d == null ? '_' : d).join(' '); $('codepanel').classList.add('active'); $('cinput').value = ''; setTimeout(() => $('cinput').focus(), 50); }
  function closeTerm(send) { if (send) Net.emit('interact', { k: 'term', code: $('cinput').value }); panelOpen = false; $('codepanel').classList.remove('active'); $('cinput').blur(); if (!isTouch && G && G.running && !G.over) canvas.requestPointerLock(); }
  $('cOk').onclick = () => closeTerm(true); $('cNo').onclick = () => closeTerm(false);
  $('cinput').addEventListener('keydown', e => { if (e.key === 'Enter') closeTerm(true); e.stopPropagation(); });
  const nextSpec = () => { if (G) G.spec++; };
  bind($('bAct'), act); bind($('bFl'), toggleFl); bind($('bHide'), hideAct); bind($('bCrouch'), toggleCrouch); bind($('bRun'), () => { touchRun = !touchRun; }); bind($('bNext'), nextSpec);
  function openChat() { chatOpen = true; $('chat').classList.add('open'); if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => $('cin').focus(), 30); }
  function closeChat(send) { const v = $('cin').value.trim(); if (send && v) Net.emit('chat', v); $('cin').value = ''; chatOpen = false; $('chat').classList.remove('open'); $('cin').blur(); if (!isTouch && G && G.running && !G.over && !panelOpen) canvas.requestPointerLock(); }
  $('cin').addEventListener('keydown', e => { if (e.key === 'Enter') closeChat(true); else if (e.key === 'Escape') closeChat(false); e.stopPropagation(); });
  $('chatBtn').addEventListener('click', () => chatOpen ? closeChat(true) : openChat());
  async function micToggle() { A.init(); try { const on = await Net.toggleVoice(); $('micBtn').classList.toggle('on', on); $('bMicL').textContent = '🎤 Voice: ' + (on ? 'AKTIF' : 'MATI'); sys('Voice chat ' + (on ? 'aktif' : 'mati')); } catch (e) { sys('Voice gagal: ' + (e.message || e.name)); } }
  $('micBtn').addEventListener('click', micToggle); $('bMicL').addEventListener('click', micToggle);
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.id !== 'cin') return;
    if (chatOpen || panelOpen) return;
    if (e.code === 'Enter' && room) { e.preventDefault(); return openChat(); }
    if (!G || !G.running) return;
    keys[e.code] = true;
    if (e.code === 'KeyE') act(); else if (e.code === 'KeyF') toggleFl(); else if (e.code === 'KeyH') hideAct(); else if (e.code === 'KeyC' || e.code === 'ControlLeft') toggleCrouch(); else if (e.code === 'KeyV') micToggle(); else if (e.code === 'Space') { e.preventDefault(); nextSpec(); }
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  /* ================= MENU / LOBBY ================= */
  try { $('nick').value = localStorage.getItem('dimz_nick') || ''; } catch (e) { }
  const err = t => { $('err').textContent = t || ''; };
  function getNick() { let n = $('nick').value.trim().slice(0, 14); if (!n) n = 'Player' + (Math.random() * 900 + 100 | 0); try { localStorage.setItem('dimz_nick', n); } catch (e) { } me.nick = n; return n; }
  $('bCreate').onclick = () => { A.init(); err(); const mode = $('mode').value; Net.emit('create', { nick: getNick(), map: $('map').value, mode }, r => { if (r && r.ok) { me.id = r.id; if (mode === 'solo') Net.emit('start'); } else err('Gagal membuat room'); }); };
  $('bJoin').onclick = () => { A.init(); err(); const code = $('rcode').value.trim().toUpperCase(); if (code.length !== 4) return err('Masukkan 4 huruf kode room'); Net.emit('join', { nick: getNick(), code }, r => { if (r && r.ok) me.id = r.id; else err((r && r.err) || 'Gagal bergabung'); }); };
  $('rcode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
  $('bHow').onclick = () => $('how').classList.add('active'); $('bHowX').onclick = () => $('how').classList.remove('active');
  $('bStart').onclick = () => Net.emit('start');
  function leaveRoom() { Net.emit('leave'); stopGame(); Net.voiceReset(); $('micBtn').classList.remove('on'); $('bMicL').textContent = '🎤 Voice: MATI'; room = null; inRoom(false); show('menu'); }
  $('bLeave').onclick = leaveRoom; $('bMenu').onclick = leaveRoom;
  $('bAgain').onclick = () => { if (room && room.host === Net.id) Net.emit('again'); };
  if (Net.socket.connected) { me.id = Net.id; $('conn').textContent = 'Terhubung ke server ✔'; $('conn').style.color = '#5a5'; }
  Net.on('connect', () => { me.id = Net.id; $('conn').textContent = 'Terhubung ke server ✔'; $('conn').style.color = '#5a5'; });
  Net.on('disconnect', () => { $('conn').textContent = 'Terputus dari server... mencoba menyambung lagi'; $('conn').style.color = '#c55'; });
  Net.on('lobby', d => {
    room = d; me.id = Net.id; if (G) stopGame(); inRoom(true); show('lobby');
    $('lcode').textContent = d.code; $('linfo').textContent = Maps.THEMES[d.map].name + ' · ' + MODE_NAME[d.mode];
    $('plist').innerHTML = ''; d.players.forEach(p => { const li = document.createElement('li'); li.textContent = p.nick + (p.id === Net.id ? ' (kamu)' : ''); if (p.id === d.host) li.className = 'h'; $('plist').appendChild(li); });
    const host = d.host === Net.id; $('bStart').style.display = host ? '' : 'none'; if (!host) { const li = document.createElement('li'); li.className = 'dim'; li.textContent = 'Menunggu host memulai...'; $('plist').appendChild(li); }
  });
  Net.on('chat', d => addChat(d.nick, d.text));
  Net.on('msg', t => { if (G && G.running) toast(t); sys(t); });

  /* ================= GAME FLOW ================= */
  function startGame(d) {
    if (G) stopGame();
    LV = buildLevel(d.map, d.esc);
    G = { map: d.map, mode: d.mode, esc: d.esc, need: d.need, dur: d.dur, doorOpen: L.doors.map(() => false), rp: {}, mons: [], digits: [null, null, null, null], keys: 0, solved: false, unlocked: false, tl: d.esc ? -1 : d.dur, snap: null, aliveN: d.players.length, running: false, over: false, spec: 0, hb: 0, amb: 12, send: 0, hudT: 0, t: 0 };
    for (let i = 0; i < 2; i++) { const g = makeMonster(); g.visible = false; scene.add(g); G.mons.push({ g, x: 0, z: 0, ry: 0, st: 0, init: false, t: 0, stepT: 0 }); }
    const mp = d.players.find(p => p.id === Net.id) || d.players[0];
    Object.assign(P, { x: mp.x, z: mp.z, yaw: 0, pitch: 0, stam: 100, bat: 100, fl: true, crouch: false, run: false, hidden: false, alive: true, esc: false, eye: 1.65, exh: false });
    touchRun = false; for (const k in keys) keys[k] = false;
    cam.position.set(P.x, 1.65, P.z);
    $('rinfo').textContent = Maps.THEMES[d.map].name + ' · ' + MODE_NAME[d.mode] + (d.esc ? ' — cari ' + d.need + ' kunci & kode terminal' : ' — bertahan ' + Math.round(d.dur / 60 * 10) / 10 + ' menit');
    ['menu', 'lobby', 'end'].forEach(s => $(s).classList.remove('active')); $('ready').classList.add('active'); $('hud').classList.remove('on'); inRoom(true);
  }
  function stopGame() {
    if (!G) return; G.over = true; G.running = false;
    Object.values(G.rp).forEach(r => { scene.remove(r.g); disposeGroup(r.g); }); G.mons.forEach(m => { scene.remove(m.g); disposeGroup(m.g); });
    if (A.ctx && A.mon) A.mon.forEach(m => m.g.gain.value = 0);
    G = null; $('hud').classList.remove('on'); ['fx', 'resume', 'codepanel'].forEach(i => $(i).classList.remove('active', 'on')); $('flash').classList.remove('on');
    panelOpen = false; if (document.pointerLockElement) document.exitPointerLock();
  }
  Net.on('start', startGame);
  $('bGo').onclick = () => {
    if (!G) return; A.init(); $('ready').classList.remove('active'); $('hud').classList.add('on'); G.running = true;
    if (isTouch) { try { const e = document.documentElement; (e.requestFullscreen || e.webkitRequestFullscreen || function () { }).call(e); screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }
    else canvas.requestPointerLock();
    toast(G.esc ? 'Cari kunci. Jangan sampai terdengar.' : 'Bertahan hidup sampai fajar.');
  };
  function die() {
    if (!P.alive) return; P.alive = false; P.hidden = false; A.scare(); const f = $('flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 120); toast('KAMU DITANGKAP... mode spectate');
    $('fx').classList.add('on'); setTimeout(() => $('fx').classList.remove('on'), 900);
  }
  Net.on('dead', d => { if (!G) return; if (d.id === Net.id) die(); else { const n = Net.players[d.id]; toast((n ? n.nick : 'Seorang pemain') + ' tewas!'); A.tone(300, 60, .6, .3, 'sawtooth'); } });
  Net.on('esc', d => { if (!G) return; if (d.id === Net.id) { P.esc = true; toast('KAMU BERHASIL KABUR!'); } else { const n = Net.players[d.id]; toast((n ? n.nick : 'Pemain') + ' berhasil kabur!'); } });
  Net.on('hide', d => { if (G && G.rp[d.id]) { const r = G.rp[d.id]; r.f = d.on ? (r.f | 16) : (r.f & ~16); } });
  Net.on('door', d => { if (!G) return; G.doorOpen[d.i] = d.open; const dr = L.doors[d.i]; A.creak(dr.wx, dr.wz); });
  Net.on('item', d => {
    if (!G) return; const m = LV.items[d.id]; if (m) { LG.remove(m); disposeGroup(m); delete LV.items[d.id]; }
    if (d.by === Net.id) { A.pick(); if (d.t === 'bat') { P.bat = Math.min(100, P.bat + 40); toast('Baterai +40%'); } else if (d.t === 'key') toast('Kunci didapat!'); }
    else if (d.t === 'key') sys(d.nick + ' menemukan kunci');
  });
  Net.on('note', d => { if (!G) return; G.digits[d.idx] = d.digit; toast('Catatan: digit ke-' + (d.idx + 1) + ' kode = ' + d.digit); });
  Net.on('prog', d => {
    if (!G) return; G.keys = d.keys; G.solved = d.solved; G.unlocked = d.unlocked;
    if (LV.gate && d.unlocked) { LV.gate.userData.mat.emissive.setHex(0x22ff55); LV.gate.userData.veil.material.color.setHex(0x33ff66); }
  });
  Net.on('snap', d => {
    if (!G) return; G.snap = d; G.tl = d.tl; let alive = 0;
    d.p.forEach(a => {
      const id = a[0], x = a[1], z = a[2], ry = a[3], f = a[4]; if (!(f & 96)) alive++;
      if (id === Net.id) { if ((f & 32) && P.alive) die(); return; }
      let r = G.rp[id];
      if (!r) { const n = (Net.players[id] && Net.players[id].nick) || '?'; r = { g: makePlayer(id, n), x, z, ry, tx: x, tz: z, tr: ry, f, stepT: 0 }; r.g.position.set(x, 0, z); scene.add(r.g); G.rp[id] = r; }
      r.tx = x; r.tz = z; r.tr = ry; r.f = f;
    });
    G.aliveN = alive;
  });
  Net.on('end', d => {
    if (!G) return; G.over = true; G.running = false; if (document.pointerLockElement) document.exitPointerLock(); ['hud'].forEach(i => $(i).classList.remove('on')); $('resume').classList.remove('active');
    const t = $('etitle'); t.textContent = d.win ? 'KALIAN SELAMAT' : 'KALIAN TEWAS'; t.dataset.t = t.textContent; t.style.color = d.win ? '#4c4' : '#d11';
    $('ereason').textContent = d.reason; $('estat').textContent = 'Waktu: ' + Math.floor(d.time / 60) + 'm ' + (d.time % 60) + 's' + (d.escaped ? ' · Kabur: ' + d.escaped : '');
    $('bAgain').style.display = (room && room.host === Net.id) ? '' : 'none'; show('end');
  });

  /* ================= UPDATE LOOP ================= */
  function solidAt(x, z) {
    const gx = Math.floor(x / CELL), gy = Math.floor(z / CELL);
    if (gx < 0 || gy < 0 || gx >= L.W || gy >= L.H || L.grid[gy][gx] === 1) return true;
    const di = L.doorIdx[gy * L.W + gx]; return di !== undefined && !G.doorOpen[di];
  }
  function blocked(x, z) {
    const r = 0.4; if (solidAt(x - r, z - r) || solidAt(x + r, z - r) || solidAt(x - r, z + r) || solidAt(x + r, z + r)) return true;
    for (const p of L.props) { const dx = x - p.x, dz = z - p.z, rr = p.r + r; if (dx * dx + dz * dz < rr * rr) return true; } return false;
  }
  function tryMove(vx, vz) { const stuck = blocked(P.x, P.z); if (!blocked(P.x + vx, P.z) || stuck) P.x += vx; if (!blocked(P.x, P.z + vz) || stuck) P.z += vz; }
  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  function update(dt) {
    if (!G) return; const gt = G.t += dt;
    // pintu & item
    L.doors.forEach((dr, i) => { const m = LV.doors[i], u = m.userData; u.o = lerp(u.o, G.doorOpen[i] ? 3.7 : 0, 1 - Math.exp(-7 * dt)); if (dr.ax === 'x') m.position.z = dr.wz + u.o; else m.position.x = dr.wx + u.o; });
    for (const m of Object.values(LV.items)) { if (m.userData.it.t !== 'term') { m.rotation.y += dt * 1.5; m.position.y = m.userData.h + Math.sin(gt * 2 + m.position.x) * .07; } }
    if (LV.gate) LV.gate.userData.veil.material.opacity = .2 + Math.sin(gt * 3) * .08;
    // pemain lain
    for (const id in G.rp) {
      const r = G.rp[id], k = 1 - Math.exp(-14 * dt); r.x = lerp(r.x, r.tx, k); r.z = lerp(r.z, r.tz, k); r.ry = angLerp(r.ry, r.tr, k);
      r.g.position.set(r.x, 0, r.z); r.g.rotation.y = r.ry; r.g.visible = !(r.f & 112); r.g.scale.y = (r.f & 4) ? .75 : 1; r.g.userData.beam.visible = r.g.userData.lamp.visible = !!(r.f & 8);
      if ((r.f & 1) && r.g.visible) { r.stepT += dt * ((r.f & 2) ? 5.8 : (r.f & 4) ? 1.7 : 3.3); if (r.stepT > 2.4) { r.stepT = 0; A.step((r.f & 4) ? .1 : (r.f & 2) ? .6 : .3, r.x, r.z); } }
    }
    // monster
    let dm = 99, chase = false;
    G.mons.forEach((m, i) => {
      const s = G.snap && G.snap.m[i], au = A.ctx && A.mon ? A.mon[i] : null;
      if (!s) { m.g.visible = false; m.g.userData.lt.intensity = 0; if (au) au.g.gain.value = 0; return; }
      if (!m.init) { m.x = s[0]; m.z = s[1]; m.ry = s[2]; m.init = true; m.g.visible = true; }
      const k = 1 - Math.exp(-10 * dt), ox = m.x, oz = m.z; m.x = lerp(m.x, s[0], k); m.z = lerp(m.z, s[1], k); m.ry = angLerp(m.ry, s[2], k * .8);
      const spd = Math.hypot(m.x - ox, m.z - oz) / Math.max(dt, .001), st = s[3], u = m.g.userData;
      m.g.position.set(m.x, 0, m.z); m.g.rotation.y = m.ry; m.t += dt * (1 + spd * .5); const sw = Math.sin(m.t * 3.4);
      u.lL.rotation.x = sw * .7; u.lR.rotation.x = -sw * .7;
      if (st === 2) { u.aL.rotation.x = -1.35 + sw * .15; u.aR.rotation.x = -1.35 - sw * .15; u.body.rotation.x = .3; } else { u.aL.rotation.x = -sw * .5; u.aR.rotation.x = sw * .5; u.body.rotation.x = .06; }
      u.headG.rotation.z = Math.sin(m.t * 1.3) * .35 + (st === 2 ? Math.sin(m.t * 17) * .15 : 0);
      u.lt.intensity = st === 2 ? 2.4 : .7;
      m.stepT += dt * spd; if (m.stepT > 7) { m.stepT = 0; A.step(1, m.x, m.z, true); }
      const d = Math.hypot(P.x - m.x, P.z - m.z); if (d < dm) dm = d; if (st === 2) chase = true;
      if (st === 2 && m.st !== 2 && d < 45) A.roar(); m.st = st;
      if (au) { A.setPos(au.p, m.x, 1.6, m.z); const tg = st === 2 ? .55 : st === 1 ? .3 : .16; au.g.gain.value = lerp(au.g.gain.value, tg, .05); }
    });
    if (!G.running) return;
    // pemain lokal
    const actv = P.alive && !P.esc; let moving = false;
    if (actv && !P.hidden && !panelOpen && !chatOpen) {
      let fx, fz; if (isTouch) { fx = joy.x; fz = joy.y; } else { fx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); fz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0); }
      const mg = Math.min(1, Math.hypot(fx, fz)); moving = mg > .12;
      const want = (keys.ShiftLeft || keys.ShiftRight || touchRun) && !P.crouch && moving && !P.exh && P.stam > 0;
      P.run = want; const spd = P.crouch ? 1.7 : want ? 5.8 : 3.3;
      if (moving) { const l = Math.hypot(fx, fz), nx = fx / l, nz = fz / l, sn = Math.sin(P.yaw), cs = Math.cos(P.yaw); tryMove((nx * cs + nz * sn) * spd * mg * dt, (-nx * sn + nz * cs) * spd * mg * dt); P.stepT += dt * spd * mg; P.bob += dt * spd * 2.2; if (P.stepT > 2.4) { P.stepT = 0; A.step(P.crouch ? .05 : want ? .5 : .2); } }
      if (want) { P.stam -= 22 * dt; if (P.stam <= 0) { P.stam = 0; P.exh = true; toast('Kehabisan tenaga!'); } } else { P.stam = Math.min(100, P.stam + (moving ? 8 : 16) * dt); if (P.exh && P.stam > 30) P.exh = false; }
    } else P.run = false;
    P.mv = moving;
    // senter
    if (P.fl && P.bat > 0 && !P.hidden && actv) { P.bat -= dt * (G.mode === 'hide' ? 1.4 : 1); if (P.bat <= 0) { P.bat = 0; P.fl = false; toast('Baterai senter habis!'); } }
    let fi = (P.fl && P.bat > 0 && !P.hidden && actv) ? 2.6 : 0;
    if (fi && (P.bat < 15 || dm < 8) && Math.random() < (dm < 8 ? .25 : .12)) fi *= Math.random() * .4; fl.intensity = fi;
    // kamera
    P.eye = lerp(P.eye, P.hidden ? 1.5 : P.crouch ? 1.0 : 1.65, 1 - Math.exp(-9 * dt));
    if (actv) { cam.position.set(P.x, P.eye + (moving ? Math.sin(P.bob) * (P.run ? .07 : .04) : 0), P.z); cam.rotation.set(P.pitch, P.yaw, 0); }
    else {
      const lst = Object.values(G.rp).filter(r => !(r.f & 96)); const t = lst.length ? lst[G.spec % lst.length] : null;
      $('specN').textContent = t ? 'Menonton: ' + ((Net.players[Object.keys(G.rp).find(k => G.rp[k] === t)] || {}).nick || '?') : (P.esc ? 'Kamu sudah kabur' : 'Tidak ada yang bisa ditonton');
      if (t) { cam.position.x = lerp(cam.position.x, t.x, .15); cam.position.z = lerp(cam.position.z, t.z, .15); cam.position.y = 1.65; cam.rotation.set(0, angLerp(cam.rotation.y, t.ry, .1), 0); }
      fl.intensity = 0;
    }
    // efek horor
    const prox = Math.max(dm < 24 ? 1 - dm / 24 : 0, chase ? .5 : 0);
    if (dm < 8) { cam.position.x += (Math.random() - .5) * .03 * (1 - dm / 8); cam.position.y += (Math.random() - .5) * .03 * (1 - dm / 8); }
    $('vig').style.opacity = (.8 + prox * .2).toFixed(2); const fxe = $('fx'); if (!P.alive) { } else { fxe.classList.toggle('on', dm < 10); fxe.style.opacity = dm < 10 ? ((1 - dm / 10) * .7).toFixed(2) : 0; }
    G.hb -= dt; if (prox > .08 && G.hb <= 0 && actv) { A.heart(); G.hb = lerp(1.1, .38, prox); }
    G.amb -= dt; if (G.amb <= 0) { G.amb = 14 + Math.random() * 20; A.amb(cam.position.x, cam.position.z); }
    A.listen(cam.position.x, cam.position.y, cam.position.z, cam.rotation.y);
    // kirim status
    G.send += dt; if (G.send > .066 && actv && !P.hidden) { G.send = 0; Net.socket.volatile.emit('st', { x: +P.x.toFixed(2), z: +P.z.toFixed(2), ry: +P.yaw.toFixed(2), mv: P.mv, run: P.run, crouch: P.crouch, fl: P.fl && P.bat > 0 }); }
    // HUD
    G.hudT += dt; if (G.hudT > .1) {
      G.hudT = 0; $('stam').style.width = P.stam + '%'; $('batt').style.width = P.bat + '%'; $('stam').style.background = P.exh ? '#822' : '#d22';
      $('timer').textContent = G.tl >= 0 ? fmt(G.tl) : ''; $('keysI').textContent = G.esc ? '🗝 Kunci: ' + G.keys + '/' + G.need + (G.solved ? ' · Terminal ✔' : '') : '';
      $('codeI').textContent = G.esc ? 'Kode: ' + G.digits.map(d => d == null ? '_' : d).join(' ') : ''; $('aliveI').textContent = 'Hidup: ' + G.aliveN;
      $('obj').textContent = G.esc ? (G.unlocked ? 'GERBANG TERBUKA — LARI!' : G.keys < G.need ? 'Temukan kunci & catatan' : 'Masukkan kode di terminal') : (G.mode === 'hide' ? 'Sembunyi dari monster' : 'Bertahan sampai fajar');
      $('bRun').classList.toggle('on', touchRun); $('bCrouch').classList.toggle('on', P.crouch); $('bFl').classList.toggle('on', P.fl && P.bat > 0);
      $('spec').style.display = actv ? 'none' : 'block'; $('hidden').style.display = P.hidden ? 'block' : 'none';
      let p = ''; if (canAct() && !P.hidden) { const t = findTarget(); if (t) p = (isTouch ? '[AKSI] ' : '[E] ') + t.label; else if (nearLocker()) p = (isTouch ? '[SEMBUNYI] ' : '[H] ') + 'Sembunyi di loker'; } $('prompt').textContent = p;
    }
  }
  let last = performance.now();
  function loop(now) { requestAnimationFrame(loop); const dt = Math.min(.05, (now - last) / 1000); last = now; if (G) { update(dt); R.render(scene, cam); } else R.clear(); }
  requestAnimationFrame(loop);
})();
