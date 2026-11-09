import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(path.join(tmpdir(), 'fason-test-'));
let proc;

before(async () => {
  proc = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) return; } catch { /* hali yo'q */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server ishga tushmadi');
});
after(() => { proc?.kill(); rmSync(dataDir, { recursive: true, force: true }); });

const post = (p, body, token) => fetch(BASE + p, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body),
});

test('server: hisob, kirish, yozish/o\'qish, himoya', async () => {
  assert.equal((await (await fetch(BASE + '/api/health')).json()).users, false);

  const s1 = await post('/api/signup', { email: 'Oila@Gmail.com', password: 'parol123' });
  assert.equal(s1.status, 200);
  const { token } = await s1.json();

  // Ikkinchi (begona) hisob ochib bo'lmaydi
  assert.equal((await post('/api/signup', { email: 'begona@x.uz', password: 'parol123' })).status, 403);
  // Noto'g'ri parol
  assert.equal((await post('/api/login', { email: 'oila@gmail.com', password: 'xato' })).status, 401);
  // Tokensiz yozib bo'lmaydi
  assert.equal((await post('/api/upsert', { rows: [] })).status, 401);

  // Ikkinchi telefon — o'sha email/parol
  const { token: t2 } = await (await post('/api/login', { email: 'oila@gmail.com', password: 'parol123' })).json();
  const up = await post('/api/upsert', { rows: [
    { kind: 'shops', id: 's1', data: { id: 's1', name: 'Abdulla aka' } },
    { kind: 'models', id: 'm1', data: { id: 'm1', name: 'Kostyum' } },
    { kind: 'boshqa', id: 'x', data: 1 }, // noma'lum tur — qabul qilinmaydi
  ] }, token);
  assert.equal(up.status, 200);

  const r1 = await (await fetch(BASE + '/api/records?since=0', { headers: { authorization: 'Bearer ' + t2 } })).json();
  assert.deepEqual(r1.rows.map((r) => r.kind + ':' + r.data.name), ['shops:Abdulla aka', 'models:Kostyum']);

  // O'chirish va "since" bo'yicha faqat yangilari
  const since = r1.rows.at(-1).updated_at;
  await post('/api/upsert', { rows: [{ kind: 'shops', id: 's1', deleted: true }] }, t2);
  const r2 = await (await fetch(BASE + '/api/records?since=' + since, { headers: { authorization: 'Bearer ' + token } })).json();
  assert.equal(r2.rows.length, 1);
  assert.equal(r2.rows[0].deleted, true);

  // Chiqqandan keyin token ishlamaydi
  await post('/api/logout', {}, t2);
  assert.equal((await fetch(BASE + '/api/records', { headers: { authorization: 'Bearer ' + t2 } })).status, 401);
});

test('server: faqat ilova fayllari ochiq', async () => {
  assert.equal((await fetch(BASE + '/')).status, 200);
  assert.equal((await fetch(BASE + '/js/app.js')).status, 200);
  for (const p of ['/server/server.js', '/data/fason.db', '/.git/config', '/tests/server.test.js', '/%2e%2e/server/server.js']) {
    assert.equal((await fetch(BASE + p)).status, 404, p);
  }
});
