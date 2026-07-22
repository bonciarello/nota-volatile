const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4600;

// In-memory store: code -> { text, expiry, timerId }
const notes = new Map();

// Generate an 8-character alphanumeric code (uppercase, easy to read — no I, O, 0, 1 ambiguity)
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
}

function scheduleDeletion(code, delayMs) {
  const timerId = setTimeout(() => {
    notes.delete(code);
  }, delayMs);
  return timerId;
}

// Parse JSON body
app.use(express.json({ limit: '64kb' }));

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

// robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Sitemap: https://github.com/bonciarello/nota-volatile/sitemap.xml
`);
});

// sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://github.com/bonciarello/nota-volatile/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://github.com/bonciarello/nota-volatile/view.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`);
});

// API: create a note
app.post('/api/notes', (req, res) => {
  const { text, durationMinutes } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Il testo della nota è obbligatorio.' });
  }
  if (text.length > 10000) {
    return res.status(400).json({ error: 'La nota non può superare i 10.000 caratteri.' });
  }
  if (!durationMinutes || typeof durationMinutes !== 'number' || durationMinutes < 1 || durationMinutes > 1440) {
    return res.status(400).json({ error: 'La durata deve essere compresa tra 1 minuto e 24 ore (1440 minuti).' });
  }

  const code = generateCode();
  const delayMs = durationMinutes * 60 * 1000;
  const timerId = scheduleDeletion(code, delayMs);

  notes.set(code, {
    text: text.trim(),
    expiry: Date.now() + delayMs,
    timerId,
    read: false
  });

  res.json({ code, expiry: Date.now() + delayMs });
});

// API: read a note (one-time, then delete)
app.get('/api/notes/:code', (req, res) => {
  const { code } = req.params;
  const note = notes.get(code);

  if (!note) {
    return res.status(404).json({ error: 'Nota non trovata. Potrebbe essere già stata letta o scaduta.' });
  }

  // Remove immediately (one-time read)
  clearTimeout(note.timerId);
  notes.delete(code);

  res.json({ text: note.text, expiry: note.expiry });
});

// Fallback: serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Nota Volatile server running on http://0.0.0.0:${PORT}`);
});
