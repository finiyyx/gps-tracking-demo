# GPS Tracking Demo (JavaScript murni)

Dashboard pelacakan GPS tanpa framework & tanpa build. Peta memakai Leaflet + OpenStreetMap (via CDN).

File: `index.html`, `style.css`, `app.js` (dashboard) dan `server.js` (server Node mini opsional untuk uji coba).

## Menjalankan

```bash
node server.js          # lalu buka http://localhost:3000
# atau tanpa Node:  python3 -m http.server 8000
```

Tiga sumber data (tab di panel kiri):

| Mode | Fungsi |
|---|---|
| **Simulasi** | 3 kendaraan virtual lengkap dengan baterai & kecepatan. Langsung jalan. |
| **GPS Ponsel** | Memakai GPS/baterai/jaringan perangkat yang membuka halaman ini. |
| **API** | Mengambil lokasi perangkat dari server Anda secara berkala (polling). |

## Panduan 1 — Memakai GPS di ponsel

Browser **hanya mengizinkan GPS di HTTPS** (atau `localhost`). Pilihan paling mudah:

1. Jalankan `node server.js` di laptop.
2. Buka tunnel HTTPS, mis. `npx localtunnel --port 3000` atau `cloudflared tunnel --url http://localhost:3000`.
3. Buka URL `https://...` itu di **Chrome Android**, pilih tab **GPS Ponsel**, tekan **Mulai**, izinkan lokasi.
   (Alternatif: deploy folder ini ke GitHub Pages / Netlify / Vercel — otomatis HTTPS.)

Data yang terbaca dari ponsel:

| Data | Sumber API browser | Catatan |
|---|---|---|
| Koordinat, akurasi, ketinggian, kecepatan, arah | `navigator.geolocation.watchPosition` | `enableHighAccuracy` aktif; kecepatan & arah hanya terisi saat bergerak |
| Baterai (%) & status mengisi, sisa waktu | `navigator.getBattery()` | Chrome/Edge Android & desktop. **Tidak ada di Safari/iOS & Firefox** |
| Jaringan (4g/wifi, Mbps, hemat data) | `navigator.connection` | Chromium saja |
| Online/offline | `navigator.onLine` | Semua browser |
| Arah kompas | `deviceorientation` | Cadangan bila `heading` GPS kosong |
| Layar tetap menyala | `navigator.wakeLock` | Agar GPS tidak berhenti saat layar mati |

Batasan: web hanya melacak selagi halaman terbuka & layar menyala. Untuk pelacakan latar belakang penuh butuh aplikasi native.

### Mengirim posisi ponsel ke server Anda
Isi **Kirim ke API** (mis. `https://server-anda.com/api/location`) dan, bila perlu, header Authorization. Tiap ±3 detik halaman melakukan `POST` JSON:

```json
{
  "id": "phone-ab12c", "name": "Ponsel saya",
  "lat": -6.2088, "lng": 106.8456,
  "speed": 4.2, "heading": 90, "altitude": 12, "accuracy": 8,
  "battery": 76, "charging": false, "timestamp": 1730000000000,
  "extra": { "Jaringan": "4g (10 Mbps)", "Layar": "412×915" }
}
```

`speed` dalam m/s, `battery` dalam persen, `timestamp` dalam ms epoch.

## Panduan 2 — Memakai API Anda sendiri

Pilih tab **API**, isi **URL API** (method `GET`) dan token bila perlu. Respons boleh berupa satu objek atau array:

```json
[
  { "id": "truk-1", "name": "Truk 1", "lat": -6.2, "lng": 106.8,
    "speed": 12.5, "heading": 90, "battery": 0.83, "charging": false,
    "timestamp": "2026-11-26T08:00:00Z" }
]
```

Jika nama field berbeda, ubah **Pemetaan field** (dot-path). Contoh untuk respons `{"data":{"vehicles":[{"device_id":"x","position":{"latitude":..,"longitude":..},"power":{"pct":80}}]}}`:

```json
{
  "root": "data.vehicles",
  "id": "device_id", "name": "device_id",
  "lat": "position.latitude", "lng": "position.longitude",
  "battery": "power.pct"
}
```

Aturan: `battery` 0–1 otomatis jadi persen; `timestamp` boleh ISO, detik, atau milidetik; perangkat dianggap *offline* bila >30 detik tak ada pembaruan.

**Syarat server:** aktifkan CORS (`Access-Control-Allow-Origin`, dan `Access-Control-Allow-Headers: Authorization` bila memakai token). Bila halaman diakses lewat HTTPS, API juga harus HTTPS. Untuk coba cepat, `server.js` sudah menyediakan `POST /api/location` dan `GET /api/devices` (`TOKEN=rahasia node server.js` untuk mewajibkan token).

### Uji coba lengkap: ponsel → server → dashboard
1. Ponsel: tab **GPS Ponsel**, Kirim ke API = `https://<tunnel>/api/location`, **Mulai**.
2. Laptop: buka dashboard, tab **API**, URL = `http://localhost:3000/api/devices`, **Mulai**.

## Keamanan
Token yang diisi di form disimpan di `localStorage` browser. Jangan menaruh token produksi di demo ini; gunakan token khusus & batasi izinnya.
