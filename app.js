/* GPS Tracking Demo — JavaScript murni + Leaflet (peta). Tanpa build, tanpa backend. */
'use strict';

const $ = (id) => document.getElementById(id);
const COLORS = ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#c084fc', '#fb923c'];
const STALE_MS = 30000; // dianggap "offline" bila tak ada update > 30 detik

/* ---------- Peta ---------- */
const map = L.map('map').setView([-6.2, 106.82], 12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap'
}).addTo(map);

/* ---------- State ---------- */
const devices = new Map(); // id -> {data, marker, trail, color, path[]}
let selected = null;
let mode = 'sim';
let runner = null; // fungsi stop() dari mode aktif
let fitted = false;

/* ---------- Config tersimpan (localStorage, opsional) ---------- */
const DEFAULT_MAP = {
  root: '',
  id: 'id', name: 'name', lat: 'lat', lng: 'lng',
  speed: 'speed', heading: 'heading', altitude: 'altitude', accuracy: 'accuracy',
  battery: 'battery', charging: 'charging', timestamp: 'timestamp'
};
const FIELDS = ['phoneName', 'postUrl', 'postAuth', 'apiUrl', 'apiAuth', 'apiInterval', 'apiMap'];
function loadCfg() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem('gpsdemo') || '{}'); } catch (e) {}
  FIELDS.forEach((f) => { if (c[f] != null) $(f).value = c[f]; });
  if (!$('apiMap').value) $('apiMap').value = JSON.stringify(DEFAULT_MAP, null, 2);
}
function saveCfg() {
  const c = {}; FIELDS.forEach((f) => (c[f] = $(f).value));
  try { localStorage.setItem('gpsdemo', JSON.stringify(c)); } catch (e) {}
}

/* ---------- Util ---------- */
const get = (obj, path) => (path ? path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj) : obj);
const num = (v) => (v == null || v === '' || isNaN(+v) ? null : +v);
const fmt = (v, d = 0, u = '') => (v == null ? '—' : v.toFixed(d) + u);
function setMsg(t, cls = '') { const m = $('msg'); m.textContent = t; m.className = 'msg ' + cls; }
function batColor(p) { return p == null ? 'var(--mut)' : p <= 15 ? 'var(--bad)' : p <= 40 ? 'var(--warn)' : 'var(--ok)'; }
function batHtml(p, charging) {
  if (p == null) return '<small>baterai —</small>';
  return `<span class="bat"><i style="width:${p}%;background:${batColor(p)}"></i></span> ${Math.round(p)}%${charging ? ' ⚡' : ''}`;
}
function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return s < 60 ? s + ' dtk lalu' : Math.round(s / 60) + ' mnt lalu';
}

/* ---------- Inti: terima data perangkat dari sumber mana pun ----------
   data = {id,name,lat,lng,speed(m/s),heading,altitude,accuracy,battery(0-100),charging,timestamp,extra{}} */
function upsert(data) {
  if (num(data.lat) == null || num(data.lng) == null) return;
  data.timestamp = data.timestamp || Date.now();
  let d = devices.get(data.id);
  if (!d) {
    const color = COLORS[devices.size % COLORS.length];
    const icon = L.divIcon({ className: '', html: `<div class="marker" style="background:${color}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
    d = { color, path: [], marker: L.marker([data.lat, data.lng], { icon }).addTo(map), trail: L.polyline([], { color, weight: 4, opacity: .7 }).addTo(map) };
    d.marker.on('click', () => select(data.id));
    devices.set(data.id, d);
  }
  d.data = { ...d.data, ...data };
  d.path.push([data.lat, data.lng]);
  if (d.path.length > 500) d.path.shift();
  d.marker.setLatLng([data.lat, data.lng]);
  d.trail.setLatLngs(d.path);
  if (!fitted) { map.setView([data.lat, data.lng], 15); fitted = true; }
  if (selected === data.id) renderDetail();
  renderList();
}

/* ---------- UI daftar & detail ---------- */
function renderList() {
  $('count').textContent = devices.size;
  $('list').innerHTML = [...devices].map(([id, d]) => {
    const x = d.data, online = Date.now() - x.timestamp < STALE_MS;
    return `<li data-id="${id}" class="${id === selected ? 'sel' : ''}">
      <span class="dot" style="background:${d.color}"></span>
      <span class="name">${esc(x.name || id)}<br><small>${online ? '🟢 online' : '🔴 offline'} · ${fmt(x.speed != null ? x.speed * 3.6 : null, 0, ' km/j')}</small></span>
      <span>${batHtml(x.battery, x.charging)}</span></li>`;
  }).join('');
  $('list').querySelectorAll('li').forEach((li) => (li.onclick = () => select(li.dataset.id)));
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function select(id) { selected = id; const d = devices.get(id); if (d) map.panTo(d.marker.getLatLng()); renderDetail(); renderList(); }
function renderDetail() {
  const d = devices.get(selected); if (!d) return;
  const x = d.data, online = Date.now() - x.timestamp < STALE_MS;
  const rows = [
    ['Nama', esc(x.name || x.id)], ['Status', online ? '🟢 Online' : '🔴 Offline'],
    ['Update terakhir', ago(x.timestamp)],
    ['Koordinat', `${x.lat.toFixed(6)}, ${x.lng.toFixed(6)}`],
    ['Kecepatan', fmt(x.speed != null ? x.speed * 3.6 : null, 1, ' km/j')],
    ['Arah', fmt(x.heading, 0, '°')], ['Ketinggian', fmt(x.altitude, 0, ' m')],
    ['Akurasi GPS', fmt(x.accuracy, 0, ' m')],
    ['Baterai', batHtml(x.battery, x.charging)],
    ...Object.entries(x.extra || {}).map(([k, v]) => [k, esc(v)])
  ];
  $('detail').innerHTML = '<h2>Detail</h2><dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
}
setInterval(() => { renderList(); renderDetail(); }, 5000);

/* ================= MODE 1: SIMULASI ================= */
function startSim() {
  const cars = [
    { id: 'sim-1', name: 'Truk A', lat: -6.2088, lng: 106.8456, hd: 40, bat: 92 },
    { id: 'sim-2', name: 'Motor B', lat: -6.1754, lng: 106.8272, hd: 200, bat: 55 },
    { id: 'sim-3', name: 'Mobil C', lat: -6.2297, lng: 106.8, hd: 120, bat: 18 }
  ];
  const tick = () => cars.forEach((c) => {
    c.hd = (c.hd + (Math.random() - .5) * 40 + 360) % 360;
    const v = 5 + Math.random() * 10; // m/s
    c.lat += Math.cos(c.hd * Math.PI / 180) * v * 2 / 111320;
    c.lng += Math.sin(c.hd * Math.PI / 180) * v * 2 / 111320;
    c.bat = Math.max(1, c.bat - 0.05);
    upsert({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, speed: v, heading: c.hd, altitude: 8, accuracy: 5, battery: c.bat, charging: false, timestamp: Date.now() });
  });
  tick(); const t = setInterval(tick, 2000);
  setMsg('Simulasi berjalan.', 'ok');
  return () => clearInterval(t);
}

/* ================= MODE 2: GPS PONSEL ================= */
function startPhone() {
  if (!('geolocation' in navigator)) throw new Error('Browser tidak mendukung Geolocation.');
  if (!window.isSecureContext) throw new Error('Geolocation butuh HTTPS (atau http://localhost).');
  const id = 'phone-' + (localStorage.getItem('gpsdemo-id') || Math.random().toString(36).slice(2, 7));
  try { localStorage.setItem('gpsdemo-id', id.slice(6)); } catch (e) {}

  let battery = null, orient = null, wake = null;
  if (navigator.getBattery) {
    navigator.getBattery().then((b) => { battery = b; }).catch(() => {});
  }
  const onOrient = (e) => { orient = e.webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null); };
  window.addEventListener('deviceorientationabsolute', onOrient);
  window.addEventListener('deviceorientation', onOrient);
  if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => (wake = w)).catch(() => {});

  const watchId = navigator.geolocation.watchPosition((pos) => {
    const c = pos.coords, conn = navigator.connection || {};
    const data = {
      id, name: $('phoneName').value || 'Ponsel',
      lat: c.latitude, lng: c.longitude, speed: c.speed, heading: c.heading ?? orient,
      altitude: c.altitude, accuracy: c.accuracy,
      battery: battery ? battery.level * 100 : null, charging: battery ? battery.charging : null,
      timestamp: pos.timestamp,
      extra: {
        Jaringan: conn.effectiveType ? `${conn.effectiveType} (${conn.downlink ?? '?'} Mbps)` : navigator.onLine ? 'online' : 'offline',
        'Hemat data': conn.saveData ? 'ya' : 'tidak',
        'Akurasi ketinggian': c.altitudeAccuracy != null ? c.altitudeAccuracy.toFixed(0) + ' m' : '—',
        Layar: screen.width + '×' + screen.height,
        'Sisa waktu baterai': battery && isFinite(battery.dischargingTime) ? Math.round(battery.dischargingTime / 60) + ' mnt' : '—'
      }
    };
    upsert(data);
    sendToApi(data);
    setMsg('GPS aktif — akurasi ' + Math.round(c.accuracy) + ' m' + (battery ? '' : ' (baterai tidak didukung browser ini)'), 'ok');
  }, (err) => setMsg('GPS error: ' + err.message, 'err'),
  { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });

  return () => {
    navigator.geolocation.clearWatch(watchId);
    window.removeEventListener('deviceorientationabsolute', onOrient);
    window.removeEventListener('deviceorientation', onOrient);
    if (wake) wake.release().catch(() => {});
  };
}
let lastPost = 0;
function sendToApi(data) {
  const url = $('postUrl').value.trim();
  if (!url || Date.now() - lastPost < 3000) return; // maks 1 kirim / 3 detik
  lastPost = Date.now();
  const { extra, ...body } = data;
  const headers = { 'Content-Type': 'application/json' };
  if ($('postAuth').value.trim()) headers.Authorization = $('postAuth').value.trim();
  fetch(url, { method: 'POST', headers, body: JSON.stringify({ ...body, ...extra && { extra } }) })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); })
    .catch((e) => setMsg('Gagal kirim ke API: ' + e.message, 'err'));
}

/* ================= MODE 3: API (polling) ================= */
function startApi() {
  const url = $('apiUrl').value.trim();
  if (!url) throw new Error('Isi URL API terlebih dahulu.');
  let m;
  try { m = { ...DEFAULT_MAP, ...JSON.parse($('apiMap').value) }; } catch (e) { throw new Error('Pemetaan field bukan JSON valid.'); }
  const interval = Math.max(1, +$('apiInterval').value || 5) * 1000;
  const headers = {};
  if ($('apiAuth').value.trim()) headers.Authorization = $('apiAuth').value.trim();

  const poll = async () => {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      let payload = get(await res.json(), m.root);
      if (!Array.isArray(payload)) payload = [payload];
      let n = 0;
      payload.forEach((it, i) => {
        let bat = num(get(it, m.battery));
        if (bat != null && bat <= 1) bat *= 100; // 0..1 -> persen
        let ts = get(it, m.timestamp);
        ts = ts == null ? Date.now() : typeof ts === 'number' ? (ts < 1e12 ? ts * 1000 : ts) : Date.parse(ts);
        const id = String(get(it, m.id) ?? 'dev-' + i);
        upsert({
          id, name: get(it, m.name) || id, lat: num(get(it, m.lat)), lng: num(get(it, m.lng)),
          speed: num(get(it, m.speed)), heading: num(get(it, m.heading)), altitude: num(get(it, m.altitude)),
          accuracy: num(get(it, m.accuracy)), battery: bat, charging: get(it, m.charging), timestamp: ts
        });
        n++;
      });
      setMsg(`OK — ${n} perangkat @ ${new Date().toLocaleTimeString()}`, 'ok');
    } catch (e) { setMsg('Gagal ambil API: ' + e.message + ' (cek URL/CORS/token)', 'err'); }
  };
  poll(); const t = setInterval(poll, interval);
  return () => clearInterval(t);
}

/* ---------- Kontrol ---------- */
const starters = { sim: startSim, phone: startPhone, api: startApi };
$('tabs').onclick = (e) => {
  const b = e.target.closest('button'); if (!b || runner) return;
  mode = b.dataset.mode;
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.mode').forEach((x) => x.classList.toggle('hidden', x.id !== 'mode-' + mode));
  setMsg('');
};
$('start').onclick = () => {
  if (runner) return;
  try { saveCfg(); runner = starters[mode](); } catch (e) { setMsg(e.message, 'err'); return; }
  $('start').disabled = true; $('stop').disabled = false;
};
$('stop').onclick = () => {
  if (runner) runner(); runner = null;
  $('start').disabled = false; $('stop').disabled = true; setMsg('Dihentikan.');
};
$('clear').onclick = () => devices.forEach((d) => { d.path = d.path.slice(-1); d.trail.setLatLngs(d.path); });

/* Status koneksi browser */
function updConn() { const c = $('conn'); c.textContent = navigator.onLine ? '● online' : '● offline'; c.className = 'pill ' + (navigator.onLine ? 'on' : 'off'); }
addEventListener('online', updConn); addEventListener('offline', updConn); updConn();

loadCfg();
