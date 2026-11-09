// O'z serveringiz bilan sinxronlash: kirish, yuborish, olish va jonli yangilanish (SSE).
import { createEngine, emptyMeta } from './sync-core.js';
import { kvGet, kvPut } from './store.js';

const CFG_KEY = 'fason-sync-cfg';   // { url }
const AUTH_KEY = 'fason-sync-auth'; // { token, user }
const META_KEY = 'syncmeta';

export const status = { configured: false, user: null, state: 'off', last: null, error: '', pending: 0 };

let hooks = null, cfg = null, auth = null, engine = null, events = null, timer = null, running = null;

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => (v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k));
export const getConfig = () => cfg;

function emit(patch = {}) {
  Object.assign(status, patch);
  hooks?.onStatus?.(status);
}

async function call(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(cfg.url + pathname, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(auth ? { authorization: 'Bearer ' + auth.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* bo'sh */ }
  if (res.status === 401 && auth && !pathname.startsWith('/api/login')) await dropAuth();
  if (!res.ok) throw new Error(data?.error || `Server xatosi (${res.status})`);
  return data;
}

export async function init(h) {
  hooks = h;
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => emit({ state: 'offline' }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });

  cfg = read(CFG_KEY);
  // Ilova serverning o'zidan ochilgan bo'lsa — manzil kiritish shart emas
  if (!cfg && /^https?:$/.test(location.protocol) && !location.hostname.endsWith('github.io')) {
    try {
      const r = await fetch(location.origin + '/api/health', { cache: 'no-store' });
      if (r.ok && (await r.json()).ok) { cfg = { url: location.origin }; write(CFG_KEY, cfg); }
    } catch { /* server yo'q */ }
  }
  if (!cfg) return;
  auth = read(AUTH_KEY);
  emit({ configured: true, user: auth?.user || null, state: auth ? 'pending' : 'login' });
  if (auth) await start();
}

export async function configure(url) {
  url = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(url)) url = 'https://' + url;
  if (location.protocol === 'https:' && url.startsWith('http:')) throw new Error("Manzil https:// bilan bo'lishi kerak");
  const res = await fetch(url + '/api/health', { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) throw new Error("Serverga ulanib bo'lmadi. Manzilni tekshiring.");
  cfg = { url };
  write(CFG_KEY, cfg);
  emit({ configured: true, state: 'login', error: '' });
}

export async function forgetConfig() {
  await logout();
  cfg = null;
  write(CFG_KEY, null);
  emit({ configured: false, state: 'off', user: null, error: '' });
}

async function start() {
  let meta = null;
  try { meta = await kvGet(META_KEY); } catch { /* yangi */ }
  if (!meta || meta.uid !== auth.user.id || meta.url !== cfg.url) meta = { ...emptyMeta(), uid: auth.user.id, url: cfg.url };
  engine = createEngine({
    meta,
    saveMeta: (m) => kvPut(META_KEY, m).catch(() => {}),
    getState: hooks.getState,
    onRemoteChange: hooks.onRemoteChange,
    isBusy: hooks.isBusy,
    adapter: {
      upsert: (rows) => call('/api/upsert', { method: 'POST', body: { rows } }),
      async fetchSince(since) {
        const out = [];
        let from = Number(since || 0);
        for (;;) {
          const { rows, more } = await call('/api/records?since=' + from);
          out.push(...rows);
          if (!more || !rows.length) break;
          from = Number(rows[rows.length - 1].updated_at);
        }
        return out;
      },
    },
  });
  openEvents();
  await syncNow();
}

function openEvents() {
  closeEvents();
  if (!auth || typeof EventSource === 'undefined') return;
  events = new EventSource(`${cfg.url}/api/events?token=${encodeURIComponent(auth.token)}`);
  events.onmessage = (e) => {
    try { engine?.apply(JSON.parse(e.data)); emit({ last: new Date() }); } catch { /* */ }
  };
  // Qayta ulanganda (internet uzilib qolgan bo'lsa) o'tkazib yuborilganlarini olamiz
  events.onopen = () => syncNow();
}
function closeEvents() { if (events) { events.close(); events = null; } }

async function dropAuth() {
  closeEvents();
  auth = null;
  engine = null;
  write(AUTH_KEY, null);
  emit({ user: null, state: 'login' });
}

export async function syncNow() {
  if (!engine) return;
  if (!navigator.onLine) { emit({ state: 'offline', pending: engine.pendingCount() }); return; }
  if (running) return running;
  running = (async () => {
    emit({ state: 'syncing' });
    try {
      await engine.push();
      await engine.pull();
      emit({ state: 'ok', last: new Date(), error: '', pending: 0 });
    } catch (e) {
      if (engine) emit({ state: navigator.onLine ? 'error' : 'offline', error: e.message || String(e), pending: engine.pendingCount() });
    }
  })();
  try { await running; } finally { running = null; }
}

export function schedulePush() {
  if (!engine) return;
  emit({ state: navigator.onLine ? 'pending' : 'offline' });
  clearTimeout(timer);
  timer = setTimeout(syncNow, 1000);
}

export function flush() { engine?.flush(); }

async function afterLogin(r) {
  auth = { token: r.token, user: r.user };
  write(AUTH_KEY, auth);
  emit({ user: r.user, error: '' });
  await start();
}

export async function signIn(email, password) {
  await afterLogin(await call('/api/login', { method: 'POST', body: { email, password } }));
}

export async function signUp(email, password) {
  await afterLogin(await call('/api/signup', { method: 'POST', body: { email, password } }));
}

export async function logout() {
  if (auth && cfg) { try { await call('/api/logout', { method: 'POST' }); } catch { /* */ } }
  try { await kvPut(META_KEY, null); } catch { /* */ }
  await dropAuth();
}

export function shareLink() {
  if (!cfg) return '';
  // Ilova serverdan ochilgan bo'lsa — oddiy manzilning o'zi yetarli
  if (cfg.url === location.origin) return location.origin + location.pathname;
  return `${location.origin}${location.pathname}#/connect/${btoa(JSON.stringify({ url: cfg.url })).replace(/=+$/, '')}`;
}

export function parseShare(code) {
  const v = JSON.parse(atob(code + '==='.slice((code.length + 3) % 4)));
  if (!v.url) throw new Error('bad');
  return v;
}
