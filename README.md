# DIMZ HORROR NIGHT
Game horor survival multiplayer 3D (Three.js + Node.js + Socket.IO). Maks. 8 pemain per room, 5 map, 4 mode, voice chat, chat teks, spectate.

## 1. Menjalankan di komputer / HP (lokal)
Butuh Node.js 16+ (disarankan 18/20/22).
```bash
cd dimz-horror-night
npm install        # memasang socket.io dan three
npm start          # server di http://localhost:3000
```
- Buka `http://localhost:3000` di browser (Chrome disarankan).
- Main bersama teman di Wi-Fi yang sama: cari IP komputer (`ipconfig` / `ifconfig`), lalu teman buka `http://IP-KOMPUTER:3000`.
- Voice chat butuh HTTPS atau `localhost` (aturan browser). Lewat IP lokal http, voice tidak aktif, tapi chat teks tetap jalan.

## 2. Cara bermain
1. Isi nickname, pilih map dan mode, tekan **BUAT ROOM / MAIN**. Bagikan **kode room 4 huruf** ke teman, mereka tekan **GABUNG**.
2. Host menekan **MULAI**. Semua pemain menekan **MASUK KEGELAPAN**. (Mode **Solo** langsung mulai.)

| Mode | Tujuan |
|---|---|
| Survival | Bertahan sampai fajar (5 menit). Monster ke-2 muncul di tengah waktu. |
| Escape | Ambil 3 kunci, baca 4 catatan untuk mendapat kode 4 digit, masukkan di terminal, lalu lari ke gerbang keluar. |
| Hide & Seek | 2 monster sejak awal, bertahan 4 menit, sembunyi di loker. Baterai habis lebih cepat. |
| Solo | Escape sendirian melawan AI. |

**Kontrol PC:** WASD gerak · Mouse kamera · Shift lari · C jongkok · E interaksi (pintu, item, terminal) · F senter · H sembunyi/keluar loker · Enter chat · V voice · Spasi ganti spectate.
**Kontrol Android (landscape):** joystick kiri = gerak · geser layar kanan = kamera · tombol LARI (toggle), JONGKOK (toggle), SENTER, SEMBUNYI, AKSI. Tombol 💬 chat dan 🎤 voice di pojok kanan atas.

**Tips:** monster *mendengar*. Lari = sangat berisik (radius ~15 m), jalan = sedang (~7 m), jongkok = hampir senyap (~2.5 m). Stamina habis = tidak bisa lari sebentar. Tutup pintu di belakangmu: pintu tertutup memblokir pandangan monster (tapi monster bisa membukanya). Bersembunyi di loker membuatmu tak terlihat, tapi monster yang berdiri terlalu lama di dekat lokermu akan menemukanmu.

## 3. Hosting server online (agar teman di mana saja bisa main)
Server memakai `process.env.PORT` dan endpoint `/health`, jadi cocok untuk platform Node.js apa pun.

### Opsi A - Render.com (gratis, mudah, HTTPS otomatis)
1. Upload project ke repo GitHub.
2. Render → New → **Web Service** → pilih repo.
3. Build Command: `npm install` · Start Command: `npm start`.
4. Setelah deploy, buka URL `https://nama-app.onrender.com`. (Plan gratis "tidur" saat sepi, pemain pertama menunggu ~30 detik.)

### Opsi B - Railway / Fly.io / Glitch
Sama: deploy repo, perintah start `npm start`, platform otomatis menyediakan `PORT` dan HTTPS.

### Opsi C - VPS (Ubuntu) + HTTPS (kualitas terbaik, latensi rendah)
```bash
sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx
cd /opt && git clone <repo-kamu> dimz && cd dimz && npm install
sudo npm i -g pm2 && PORT=3000 pm2 start server.js --name dimz && pm2 save && pm2 startup
```
Nginx (`/etc/nginx/sites-available/dimz`), **WebSocket wajib diaktifkan**:
```nginx
server {
  server_name game.domainmu.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}
```
Lalu `sudo ln -s /etc/nginx/sites-available/dimz /etc/nginx/sites-enabled/ && sudo certbot --nginx -d game.domainmu.com`.

### Tes cepat dari HP lewat internet (tanpa hosting)
`npx cloudflared tunnel --url http://localhost:3000` (atau `ngrok http 3000`) memberi URL HTTPS publik sementara, voice chat juga berfungsi.

## 4. Struktur project
```
index.html      UI (menu, lobby, HUD, kontrol sentuh)
style.css       tema hitam-merah, efek glitch
game.js         engine 3D, kontrol, monster, audio prosedural, HUD
multiplayer.js  Socket.IO client + voice chat WebRTC
maps.js         generator 5 map (dipakai server & client, seed tetap)
server.js       server HTTP + Socket.IO, room, AI monster, aturan game
package.json
assets/ models/ sounds/ textures/   (opsional; grafis & suara dibuat prosedural)
```
Three.js dilayani lokal dari `node_modules` (r128); jika gagal otomatis memakai CDN cdnjs.

## 5. Catatan teknis
- Monster AI, pintu, item, loker, kemenangan/kekalahan: **otoritatif di server** (20 Hz, snapshot 10 Hz).
- Posisi pemain dikirim klien (cocok untuk main bersama teman; belum ada anti-cheat).
- Voice chat: WebRTC mesh dengan STUN Google. Untuk jaringan yang ketat (NAT simetris) tambahkan server TURN pada `ICE` di `multiplayer.js`.
- Performa HP: pixel ratio dibatasi 1.25, tanpa shadow map, hanya 1 senter + 2 cahaya monster. Jika masih berat, kurangi `fd`/jarak `far` kamera di `game.js`.
- Menambah map: tambahkan entri baru di `THEMES` pada `maps.js` dan `<option>` di `index.html`.
