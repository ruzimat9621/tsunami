// Sinxronlash mantig'i (serverga bog'liq emas — testlanadi).
// Har bir yozuv (fason, do'kon, sex, oylik rasxod, rasm) serverda alohida qator bo'lib saqlanadi.
// Mahalliy holat oxirgi sinxronlangan holat bilan solishtiriladi (hash), faqat o'zgarganlari yuboriladi.

export const KINDS = ['models', 'shops', 'workshops', 'overhead', 'recurring', 'orders'];
const CHUNK = 15;

export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort()
    .map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

// cyrb53 — tez, yetarlicha ishonchli hash
export function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + ':' + str.length;
}

export function toRecords(st) {
  const map = new Map();
  for (const kind of KINDS) {
    for (const it of st[kind] || []) if (it && it.id) map.set(kind + ':' + it.id, { kind, id: it.id, data: it });
  }
  for (const [id, d] of Object.entries(st.photos || {})) map.set('photos:' + id, { kind: 'photos', id, data: { d } });
  return map;
}

function putLocal(st, kind, id, data) {
  if (kind === 'photos') { (st.photos ||= {})[id] = data.d; return; }
  if (!KINDS.includes(kind)) return;
  const list = (st[kind] ||= []);
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) list[i] = data;
  else if (kind === 'models') list.unshift(data);
  else list.push(data);
}

function removeLocal(st, kind, id) {
  if (kind === 'photos') { if (st.photos && id in st.photos) { delete st.photos[id]; return true; } return false; }
  const list = st[kind] || [];
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
}

export const emptyMeta = () => ({ snap: {}, lastPull: null });

// adapter: { upsert(rows), fetchSince(isoOrNull) → rows[{kind,id,data,deleted,updated_at}] }
export function createEngine({ adapter, getState, onRemoteChange, isBusy = () => false, meta, saveMeta = () => {} }) {
  let queue = [];

  function pending() {
    const recs = toRecords(getState());
    const rows = [];
    for (const [key, r] of recs) {
      const h = hash(stableStringify(r.data));
      if (meta.snap[key] !== h) rows.push({ key, h, kind: r.kind, id: r.id, data: r.data, deleted: false });
    }
    for (const key of Object.keys(meta.snap)) {
      if (recs.has(key)) continue;
      const i = key.indexOf(':');
      rows.push({ key, h: null, kind: key.slice(0, i), id: key.slice(i + 1), data: null, deleted: true });
    }
    // Rasmlar birinchi — boshqa telefonda fason rasmsiz ko'rinib qolmasin
    rows.sort((a, b) => (b.kind === 'photos') - (a.kind === 'photos'));
    return rows;
  }

  async function push() {
    const rows = pending();
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      await adapter.upsert(chunk.map(({ kind, id, data, deleted }) => ({ kind, id, data, deleted })));
      for (const r of chunk) {
        if (r.h === null) delete meta.snap[r.key];
        else meta.snap[r.key] = r.h;
      }
      await saveMeta(meta);
    }
    return rows.length;
  }

  function apply(rows) {
    if (!rows.length) return false;
    if (isBusy()) { queue.push(...rows); return false; }
    const st = getState();
    let changed = false;
    for (const r of rows) {
      if (r.updated_at && (!meta.lastPull || r.updated_at > meta.lastPull)) meta.lastPull = r.updated_at;
      const key = r.kind + ':' + r.id;
      if (r.deleted) {
        if (removeLocal(st, r.kind, r.id)) changed = true;
        delete meta.snap[key];
        continue;
      }
      const h = hash(stableStringify(r.data));
      if (meta.snap[key] === h) continue; // bizda allaqachon shu holat bor
      putLocal(st, r.kind, r.id, r.data);
      meta.snap[key] = h;
      changed = true;
    }
    saveMeta(meta);
    if (changed) onRemoteChange();
    return changed;
  }

  async function pull() {
    const rows = await adapter.fetchSince(meta.lastPull);
    return apply(rows);
  }

  function flush() {
    if (!queue.length || isBusy()) return false;
    const q = queue;
    queue = [];
    return apply(q);
  }

  return { push, pull, apply, flush, pendingCount: () => pending().length, meta };
}
