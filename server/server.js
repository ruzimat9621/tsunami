// Fason hisob — o'z serveringiz uchun backend.
// Ilovani (statik fayllar) beradi, ma'lumotni SQLite da saqlaydi, parol bilan kirish va jonli yangilanish (SSE).
// Tashqi kutubxona kerak emas: Node.js 22.13+ (node:sqlite).
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { readFile, mkdir, readdir, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || ROOT);
const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP === '1';
const MAX_BODY = 30 * 1024 * 1024;

await mkdir(path.join(DATA_DIR, 'backups'), { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'fason.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    pass TEXT NOT NULL,
    created TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS records (
    owner INTEGER NOT NULL,
    kind TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT,
    deleted INTEGER NOT NULL DEFAULT 0,
    rev INTEGER NOT NULL,
    PRIMARY KEY (owner, kind, id)
  );
  CREATE INDEX IF NOT EXISTS records_rev ON records (owner, rev);
`);

let rev = db.prepare('SELECT COALESCE(MAX(rev), 0) AS r FROM records').get().r;
const pad = (n) => String(n).padStart(12, '0'); // mijoz satr sifatida solishtiradi

// ---------- Yordamchilar ----------
const sha = (s) => createHash('sha256').update(s).digest('hex');
function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [salt, hex] = stored.split(':');
  const a = Buffer.from(hex, 'hex');
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};
function send(res, code, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(code, { ...CORS, ...(isJson ? { 'content-type': 'application/json; charset=utf-8' } : {}), ...headers });
  res.end(isJson ? JSON.stringify(body) : body);
}
async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error("So'rov juda katta"), { code: 413 });
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error("JSON noto'g'ri"), { code: 400 }); }
}
function userFromToken(token) {
  if (!token) return null;
  const row = db.prepare('SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?').get(sha(token));
  return row || null;
}
function auth(req) {
  const h = req.headers.authorization || '';
  return userFromToken(h.startsWith('Bearer ') ? h.slice(7) : null);
}

// Parolni taxmin qilishdan himoya: IP bo'yicha 10 daqiqada 10 urinish
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  attempts.set(ip, list);
  return list.length > 10;
}
const clientIp = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

// ---------- Jonli yangilanish (Server-Sent Events) ----------
const streams = new Map(); // owner → Set(res)
function broadcast(owner, rows) {
  const set = streams.get(owner);
  if (!set) return;
  const msg = `data: ${JSON.stringify(rows)}\n\n`;
  for (const res of set) res.write(msg);
}
setInterval(() => { for (const set of streams.values()) for (const res of set) res.write(': ping\n\n'); }, 25000);

// ---------- API ----------
const upsertStmt = db.prepare(`
  INSERT INTO records (owner, kind, id, data, deleted, rev) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT (owner, kind, id) DO UPDATE SET data = excluded.data, deleted = excluded.deleted, rev = excluded.rev`);
const KINDS = new Set(['models', 'shops', 'workshops', 'overhead', 'recurring', 'photos']);

async function api(req, res, url) {
  const route = url.pathname.slice(4); // "/api" dan keyingi qism
  if (route === '/health') return send(res, 200, { ok: true, users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0 });

  if (route === '/signup' && req.method === 'POST') {
    const { email, password } = await readJson(req);
    if (tooMany(clientIp(req))) return send(res, 429, { error: "Ko'p urinish. 10 daqiqadan keyin qayta urining." });
    const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    if (count > 0 && !ALLOW_SIGNUP) return send(res, 403, { error: "Hisob allaqachon ochilgan. Shu email va parol bilan \"Kirish\" ni bosing." });
    const e = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return send(res, 400, { error: "Email noto'g'ri" });
    if (String(password || '').length < 6) return send(res, 400, { error: "Parol kamida 6 belgi bo'lsin" });
    try {
      const { lastInsertRowid } = db.prepare('INSERT INTO users (email, pass) VALUES (?, ?)').run(e, hashPassword(String(password)));
      return send(res, 200, login(Number(lastInsertRowid), e));
    } catch {
      return send(res, 409, { error: 'Bu email band' });
    }
  }

  if (route === '/login' && req.method === 'POST') {
    const { email, password } = await readJson(req);
    if (tooMany(clientIp(req))) return send(res, 429, { error: "Ko'p urinish. 10 daqiqadan keyin qayta urining." });
    const u = db.prepare('SELECT id, email, pass FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
    if (!u || !checkPassword(String(password || ''), u.pass)) return send(res, 401, { error: "Email yoki parol noto'g'ri" });
    return send(res, 200, login(u.id, u.email));
  }

  if (route === '/events' && req.method === 'GET') {
    const user = userFromToken(url.searchParams.get('token'));
    if (!user) return send(res, 401, { error: 'Kirish kerak' });
    res.writeHead(200, { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write(': ok\n\n');
    if (!streams.has(user.id)) streams.set(user.id, new Set());
    streams.get(user.id).add(res);
    req.on('close', () => streams.get(user.id)?.delete(res));
    return;
  }

  const user = auth(req);
  if (!user) return send(res, 401, { error: 'Kirish kerak' });

  if (route === '/logout' && req.method === 'POST') {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(req.headers.authorization.slice(7)));
    return send(res, 200, { ok: true });
  }

  if (route === '/upsert' && req.method === 'POST') {
    const { rows } = await readJson(req);
    if (!Array.isArray(rows)) return send(res, 400, { error: 'rows kerak' });
    const out = [];
    db.exec('BEGIN');
    try {
      for (const r of rows) {
        if (!KINDS.has(r.kind) || typeof r.id !== 'string' || !r.id) continue;
        rev++;
        upsertStmt.run(user.id, r.kind, r.id, r.deleted ? null : JSON.stringify(r.data ?? null), r.deleted ? 1 : 0, rev);
        out.push({ kind: r.kind, id: r.id, data: r.deleted ? null : r.data, deleted: !!r.deleted, updated_at: pad(rev) });
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    broadcast(user.id, out);
    return send(res, 200, { ok: true, rev: pad(rev) });
  }

  if (route === '/records' && req.method === 'GET') {
    const since = Number(url.searchParams.get('since') || 0) || 0;
    const rows = db.prepare('SELECT kind, id, data, deleted, rev FROM records WHERE owner = ? AND rev > ? ORDER BY rev LIMIT 300').all(user.id, since);
    return send(res, 200, {
      rows: rows.map((r) => ({ kind: r.kind, id: r.id, data: r.data ? JSON.parse(r.data) : null, deleted: !!r.deleted, updated_at: pad(r.rev) })),
      more: rows.length === 300,
    });
  }

  return send(res, 404, { error: 'Topilmadi' });
}

function login(userId, email) {
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)').run(sha(token), userId);
  return { token, user: { id: userId, email } };
}

// ---------- Statik fayllar (ilovaning o'zi) ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
};
const ALLOWED_TOP = new Set(['', 'index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'icons']);

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (!ALLOWED_TOP.has(rel.split('/')[0])) return send(res, 404, 'Topilmadi', { 'content-type': 'text/plain; charset=utf-8' });
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(STATIC_DIR, rel);
  if (!file.startsWith(STATIC_DIR + path.sep)) return send(res, 403, 'Taqiqlangan');
  try {
    const body = await readFile(file);
    send(res, 200, body, {
      'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache',
      ...(rel === 'sw.js' ? { 'service-worker-allowed': '/' } : {}),
    });
  } catch {
    send(res, 404, 'Topilmadi', { 'content-type': 'text/plain; charset=utf-8' });
  }
}

// ---------- Kunlik zaxira (oxirgi 14 kun) ----------
async function backup() {
  const dir = path.join(DATA_DIR, 'backups');
  const file = path.join(dir, `fason-${new Date().toISOString().slice(0, 10)}.db`);
  if (!existsSync(file)) db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.db')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 14))) await unlink(path.join(dir, f)).catch(() => {});
}
setTimeout(() => backup().catch(console.error), 10000);
setInterval(() => backup().catch(console.error), 6 * 3600 * 1000);

// ---------- Server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method' });
    return await serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) send(res, e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.code ? e.message : 'Server xatosi' });
    if (!e.code) console.error(e);
  }
});
server.listen(PORT, () => console.log(`Fason hisob server: http://localhost:${PORT}  (ma'lumot: ${DATA_DIR})`));
await stat(path.join(STATIC_DIR, 'index.html')).catch(() => console.warn('Diqqat: index.html topilmadi —', STATIC_DIR));
