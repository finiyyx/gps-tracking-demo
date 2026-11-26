// Server mini (Node.js, tanpa dependensi) untuk mencoba alur lengkap:
//   ponsel --POST--> /api/location   |   dashboard --GET--> /api/devices
// Jalankan: node server.js   (port 3000, atau PORT=xxxx node server.js)
const http = require('http');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TOKEN || ''; // isi untuk mewajibkan "Authorization: Bearer <TOKEN>"
const devices = {};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  if (req.url.startsWith('/api/')) {
    if (TOKEN && req.headers.authorization !== 'Bearer ' + TOKEN) return res.writeHead(401).end('unauthorized');
    if (req.method === 'POST' && req.url === '/api/location') {
      let b = ''; req.on('data', (c) => (b += c));
      req.on('end', () => {
        try { const d = JSON.parse(b); devices[d.id] = d; res.writeHead(204).end(); }
        catch (e) { res.writeHead(400).end('bad json'); }
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/api/devices') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(Object.values(devices)));
    }
    return res.writeHead(404).end();
  }
  const f = path.join(__dirname, req.url === '/' ? 'index.html' : path.basename(req.url));
  fs.readFile(f, (e, data) => {
    if (e) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }).end(data);
  });
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
