/* Lapisan jaringan: Socket.IO (room, sinkronisasi, chat) + Voice chat WebRTC (sinyal lewat Socket.IO). */
(function () {
  'use strict';
  const socket = io({ transports: ['websocket', 'polling'] });
  const Net = { socket, id: null, players: {}, h: {}, mic: false, on(e, f) { this.h[e] = f; }, emit(e, d, cb) { socket.emit(e, d, cb); } };
  window.Net = Net;
  socket.on('connect', () => { Net.id = socket.id; Net.h.connect && Net.h.connect(); });
  socket.on('disconnect', () => Net.h.disconnect && Net.h.disconnect());
  socket.on('connect_error', () => Net.h.disconnect && Net.h.disconnect());
  ['lobby', 'start', 'snap', 'door', 'item', 'prog', 'note', 'dead', 'hide', 'end', 'chat', 'msg', 'esc'].forEach(e =>
    socket.on(e, d => { if (e === 'lobby') { Net.players = {}; d.players.forEach(p => Net.players[p.id] = p); syncVoice(); } if (e === 'start') { d.players.forEach(p => Net.players[p.id] = p); } Net.h[e] && Net.h[e](d); }));

  /* ---------- Voice chat (mesh WebRTC; butuh HTTPS / localhost untuk mikrofon) ---------- */
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  const outP = {}, inP = {}; let mic = null;
  function audioEl(id, stream) {
    let a = document.getElementById('va' + id);
    if (!a) { a = document.createElement('audio'); a.id = 'va' + id; a.autoplay = true; a.playsInline = true; document.body.appendChild(a); }
    a.srcObject = stream; const p = a.play && a.play(); if (p && p.catch) p.catch(() => { });
  }
  async function callPeer(to) {
    if (!mic || outP[to]) return;
    const pc = new RTCPeerConnection(ICE); outP[to] = pc;
    mic.getTracks().forEach(t => pc.addTrack(t, mic));
    pc.onicecandidate = e => e.candidate && socket.emit('rtc', { to, k: 'ice', role: 'out', c: e.candidate });
    const o = await pc.createOffer(); await pc.setLocalDescription(o);
    socket.emit('rtc', { to, k: 'offer', sdp: pc.localDescription });
  }
  function syncVoice() { if (mic) Object.keys(Net.players).forEach(id => id !== Net.id && callPeer(id)); }
  function addIce(pc, c, n) { pc.addIceCandidate(c).catch(() => { if (n < 4) setTimeout(() => addIce(pc, c, n + 1), 400); }); }
  socket.on('rtc', async d => {
    try {
      const from = d.from;
      if (d.k === 'offer') {
        if (inP[from]) inP[from].close();
        const pc = new RTCPeerConnection(ICE); inP[from] = pc;
        pc.ontrack = e => audioEl(from, e.streams[0]);
        pc.onicecandidate = e => e.candidate && socket.emit('rtc', { to: from, k: 'ice', role: 'in', c: e.candidate });
        await pc.setRemoteDescription(d.sdp); const a = await pc.createAnswer(); await pc.setLocalDescription(a);
        socket.emit('rtc', { to: from, k: 'answer', sdp: pc.localDescription });
      } else if (d.k === 'answer') { outP[from] && await outP[from].setRemoteDescription(d.sdp); }
      else if (d.k === 'ice') { const pc = d.role === 'out' ? inP[from] : outP[from]; pc && addIce(pc, d.c, 0); }
    } catch (e) { console.warn('rtc', e); }
  });
  Net.toggleVoice = async function () {
    if (mic) { mic.getTracks().forEach(t => t.stop()); mic = null; Object.values(outP).forEach(p => p.close()); for (const k in outP) delete outP[k]; Net.mic = false; return false; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Mikrofon butuh HTTPS atau localhost');
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    Net.mic = true; syncVoice(); return true;
  };
  Net.voiceReset = function () { if (mic) { mic.getTracks().forEach(t => t.stop()); mic = null; } Object.values(outP).forEach(p => p.close()); Object.values(inP).forEach(p => p.close()); for (const k in outP) delete outP[k]; for (const k in inP) delete inP[k]; Net.mic = false; };
})();
