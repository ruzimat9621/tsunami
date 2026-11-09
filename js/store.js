// Ma'lumotlar telefonning o'zida (IndexedDB) saqlanadi — internetsiz ishlaydi.

const DB_NAME = 'fason-hisob';
const STORE = 'kv';
const KEY = 'state';

export function emptyState() {
  return {
    version: 1,
    shops: [],
    workshops: [],
    models: [],
    overhead: [],
    recurring: [],
  };
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;
const db = () => (dbPromise ||= openDb());

export async function loadState() {
  try {
    const d = await db();
    const val = await new Promise((resolve, reject) => {
      const r = d.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return normalize(val);
  } catch (e) {
    console.warn('IndexedDB ishlamadi, localStorage ishlatiladi', e);
    try { return normalize(JSON.parse(localStorage.getItem(DB_NAME) || 'null')); }
    catch { return emptyState(); }
  }
}

export async function saveState(state) {
  try {
    const d = await db();
    await new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(state, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    localStorage.setItem(DB_NAME, JSON.stringify(state));
  }
}

export function normalize(val) {
  const base = emptyState();
  if (!val || typeof val !== 'object') return base;
  const s = { ...base, ...val };
  for (const k of ['shops', 'workshops', 'models', 'overhead', 'recurring']) {
    if (!Array.isArray(s[k])) s[k] = [];
  }
  s.models = s.models.map((m) => ({
    materials: [], expenses: [], receipts: [], sales: [],
    wsMode: 'split', markupType: '%', status: 'jarayonda',
    ...m,
  }));
  return s;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
