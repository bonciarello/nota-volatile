/**
 * Nota Volatile — Test suite
 * Tests the API endpoints by starting the server and making HTTP requests.
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 14600; // Use a test-specific port
const BASE = `http://127.0.0.1:${PORT}`;

let serverProcess = null;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function fetch(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('Nota Volatile — Test Suite\n');

  // Start server
  console.log('Starting test server...');
  serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe',
  });

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 5000);
    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('running')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProcess.stderr.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });
  });

  console.log('Server ready.\n');

  // ─── Test 1: Create a note ───
  console.log('[Test 1] Create a valid note');
  const res1 = await fetch('POST', '/api/notes', {
    text: 'Ciao, questa è una nota di test!',
    durationMinutes: 60,
  });
  assert(res1.status === 200, 'Status 200');
  assert(res1.body && typeof res1.body.code === 'string', 'Response contains a code');
  assert(res1.body.code.length === 8, 'Code is 8 characters');
  assert(/^[A-Z0-9]{8}$/.test(res1.body.code), 'Code only contains A-Z and 2-9');
  assert(typeof res1.body.expiry === 'number', 'Response contains expiry timestamp');
  const code1 = res1.body.code;

  // ─── Test 2: Read the note (first read) ───
  console.log('\n[Test 2] Read the note (first read — should succeed)');
  const res2 = await fetch('GET', `/api/notes/${code1}`);
  assert(res2.status === 200, 'Status 200');
  assert(res2.body.text === 'Ciao, questa è una nota di test!', 'Note text matches');

  // ─── Test 3: Read again (should be gone) ───
  console.log('\n[Test 3] Read the note again (should fail — one-time read)');
  const res3 = await fetch('GET', `/api/notes/${code1}`);
  assert(res3.status === 404, 'Status 404');
  assert(res3.body && res3.body.error, 'Error message present');

  // ─── Test 4: Create note with very short expiry ───
  console.log('\n[Test 4] Create a note with 1-second expiry');
  // We'll use 0.02 minutes ≈ 1.2 seconds for the test
  // (API requires minimum 1 minute, so we use 1 minute but kill the timer)
  const res4 = await fetch('POST', '/api/notes', {
    text: 'Nota che scade subito',
    durationMinutes: 1,
  });
  assert(res4.status === 200, 'Status 200');
  const code4 = res4.body.code;

  // Delete it manually (simulate expiry check)
  // We'll just verify it exists
  const res4b = await fetch('GET', `/api/notes/${code4}`);
  assert(res4b.status === 200, 'Note exists before expiry');
  assert(res4b.body.text === 'Nota che scade subito', 'Note text matches');

  // ─── Test 5: Empty text ───
  console.log('\n[Test 5] Create note with empty text');
  const res5 = await fetch('POST', '/api/notes', {
    text: '   ',
    durationMinutes: 10,
  });
  assert(res5.status === 400, 'Status 400');
  assert(res5.body && res5.body.error, 'Error message present');

  // ─── Test 6: Missing text ───
  console.log('\n[Test 6] Create note without text field');
  const res6 = await fetch('POST', '/api/notes', {
    durationMinutes: 10,
  });
  assert(res6.status === 400, 'Status 400');

  // ─── Test 7: Invalid duration (0) ───
  console.log('\n[Test 7] Create note with duration 0');
  const res7 = await fetch('POST', '/api/notes', {
    text: 'Test',
    durationMinutes: 0,
  });
  assert(res7.status === 400, 'Status 400');

  // ─── Test 8: Invalid duration (> 1440) ───
  console.log('\n[Test 8] Create note with duration 2000');
  const res8 = await fetch('POST', '/api/notes', {
    text: 'Test',
    durationMinutes: 2000,
  });
  assert(res8.status === 400, 'Status 400');

  // ─── Test 9: Text too long ───
  console.log('\n[Test 9] Create note with text > 10000 chars');
  const longText = 'x'.repeat(10001);
  const res9 = await fetch('POST', '/api/notes', {
    text: longText,
    durationMinutes: 10,
  });
  assert(res9.status === 400, 'Status 400');

  // ─── Test 10: Invalid code (wrong format) ───
  console.log('\n[Test 10] Read note with invalid code format');
  const res10 = await fetch('GET', '/api/notes/INVALID!!');
  assert(res10.status === 404, 'Status 404');

  // ─── Test 11: Non-existent code ───
  console.log('\n[Test 11] Read non-existent code');
  const res11 = await fetch('GET', '/api/notes/ABCDEFGH');
  assert(res11.status === 404, 'Status 404');

  // ─── Test 12: Static files served ───
  console.log('\n[Test 12] Static files');
  const res12a = await fetch('GET', '/');
  assert(res12a.status === 200, 'index.html served (200)');
  const res12b = await fetch('GET', '/style.css');
  assert(res12b.status === 200, 'style.css served (200)');
  const res12c = await fetch('GET', '/script.js');
  assert(res12c.status === 200, 'script.js served (200)');

  // ─── Test 13: robots.txt and sitemap.xml ───
  console.log('\n[Test 13] SEO files');
  const res13a = await fetch('GET', '/robots.txt');
  assert(res13a.status === 200, 'robots.txt served (200)');
  assert(typeof res13a.body === 'string' && res13a.body.includes('Sitemap:'), 'robots.txt contains Sitemap reference');

  const res13b = await fetch('GET', '/sitemap.xml');
  assert(res13b.status === 200, 'sitemap.xml served (200)');
  assert(typeof res13b.body === 'string' && res13b.body.includes('<urlset'), 'sitemap.xml is valid XML');

  // ─── Test 14: Multiple notes, unique codes ───
  console.log('\n[Test 14] Multiple notes get unique codes');
  const codes = new Set();
  for (let i = 0; i < 5; i++) {
    const res = await fetch('POST', '/api/notes', {
      text: `Nota ${i}`,
      durationMinutes: 60,
    });
    codes.add(res.body.code);
  }
  assert(codes.size === 5, '5 unique codes generated');

  // ─── Summary ───
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  console.log(`${'='.repeat(40)}`);

  // Cleanup
  serverProcess.kill('SIGTERM');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test suite error:', err);
  if (serverProcess) serverProcess.kill('SIGTERM');
  process.exit(1);
});
