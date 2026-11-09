import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, emptyMeta, stableStringify } from '../js/sync-core.js';

// Xotiradagi soxta server (haqiqiy server o'rniga)
function fakeServer() {
  const rows = new Map();
  let tick = 0;
  return {
    rows,
    adapter: {
      async upsert(list) {
        for (const r of list) {
          tick++;
          rows.set(r.kind + ':' + r.id, { ...structuredClone(r), updated_at: `2026-11-09T10:00:${String(tick).padStart(6, '0')}` });
        }
      },
      async fetchSince(since) {
        return [...rows.values()].filter((r) => !since || r.updated_at > since)
          .sort((a, b) => a.updated_at.localeCompare(b.updated_at)).map((r) => structuredClone(r));
      },
    },
  };
}

function device(server, initial = {}) {
  const d = { state: { models: [], shops: [], workshops: [], overhead: [], recurring: [], photos: {}, ...initial }, remoteChanges: 0, busy: false };
  d.engine = createEngine({
    adapter: server.adapter, meta: emptyMeta(),
    getState: () => d.state, onRemoteChange: () => d.remoteChanges++, isBusy: () => d.busy,
  });
  d.sync = async () => { await d.engine.push(); await d.engine.pull(); };
  return d;
}

const same = (a, b) => assert.equal(stableStringify(a), stableStringify(b));

test('ikki telefon: qo\'shish, tahrirlash, o\'chirish sinxronlanadi', async () => {
  const srv = fakeServer();
  const men = device(srv, { models: [{ id: 'm1', name: 'Kostyum', sales: [] }], shops: [{ id: 's1', name: 'Abdulla aka' }] });
  const ayol = device(srv);

  await men.sync();
  await ayol.sync();
  same(ayol.state.models, men.state.models);
  same(ayol.state.shops, men.state.shops);
  assert.equal(ayol.remoteChanges, 1);

  // Ayolim sotuv yozdi
  ayol.state.models[0].sales.push({ id: 'x', qty: 5, price: 250000 });
  await ayol.sync();
  await men.sync();
  assert.equal(men.state.models[0].sales.length, 1);

  // Men do'konni o'chirdim
  men.state.shops = [];
  await men.sync();
  await ayol.sync();
  assert.equal(ayol.state.shops.length, 0);
  assert.equal(srv.rows.get('shops:s1').deleted, true);

  // O'zgarish bo'lmasa hech narsa yuborilmaydi
  assert.equal(men.engine.pendingCount(), 0);
  assert.equal(await men.engine.push(), 0);
});

test('rasmlar alohida yozuv, fasondan oldin yuboriladi', async () => {
  const srv = fakeServer();
  const men = device(srv, { models: [{ id: 'm1', colorways: [{ id: 'c1', photoId: 'p1' }] }], photos: { p1: 'data:image/jpeg;base64,AAA' } });
  await men.engine.push();
  const order = [...srv.rows.values()].sort((a, b) => a.updated_at.localeCompare(b.updated_at)).map((r) => r.kind);
  assert.deepEqual(order, ['photos', 'models']);
  const ayol = device(srv);
  await ayol.sync();
  assert.equal(ayol.state.photos.p1, 'data:image/jpeg;base64,AAA');
});

test('ikki telefondagi eski ma\'lumotlar birlashadi', async () => {
  const srv = fakeServer();
  const men = device(srv, { models: [{ id: 'a', name: 'A' }] });
  const ayol = device(srv, { models: [{ id: 'b', name: 'B' }] });
  await men.sync();
  await ayol.sync();
  await men.sync();
  assert.deepEqual(men.state.models.map((m) => m.id).sort(), ['a', 'b']);
  assert.deepEqual(ayol.state.models.map((m) => m.id).sort(), ['a', 'b']);
});

test('forma ochiq turganda kelgan o\'zgarish kutib turadi', async () => {
  const srv = fakeServer();
  const men = device(srv, { models: [{ id: 'a', name: 'A' }] });
  const ayol = device(srv);
  await men.sync();
  ayol.busy = true;
  await ayol.engine.pull();
  assert.equal(ayol.state.models.length, 0);
  ayol.busy = false;
  ayol.engine.flush();
  assert.equal(ayol.state.models.length, 1);
});

test('kalitlar tartibi boshqacha bo\'lsa ham qayta yuborilmaydi (server jsonb)', async () => {
  const srv = fakeServer();
  const men = device(srv, { models: [{ id: 'a', name: 'A', code: 'K' }] });
  await men.sync();
  const row = srv.rows.get('models:a');
  row.data = { name: 'A', id: 'a', code: 'K' }; // server kalitlarni qayta tartiblaydi
  men.engine.apply([row]);
  assert.equal(men.remoteChanges, 0);
  assert.equal(men.engine.pendingCount(), 0);
});
