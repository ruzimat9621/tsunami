import { test } from 'node:test';
import assert from 'node:assert/strict';
import { num, modelSummary, materialRow, monthReport } from '../js/calc.js';

test('num vergul va bo\'shliqlarni tushunadi', () => {
  assert.equal(num('1,8'), 1.8);
  assert.equal(num('45 000'), 45000);
  assert.equal(num(''), 0);
  assert.equal(num('abc'), 0);
});

test('material: nechta chiqadi, ishlatildi, qoldi', () => {
  const r = materialRow({ qty: 100, price: 30000, perItem: 1.8 }, 50);
  assert.equal(r.total, 3_000_000);
  assert.equal(r.possible, 55); // 100 / 1.8 = 55.5
  assert.equal(r.used, 90);
  assert.equal(r.left, 10);
  assert.equal(r.leftValue, 300_000);
});

test('material yetmasa minus qoladi', () => {
  const r = materialRow({ qty: 50, price: 1000, perItem: 1.5 }, 40);
  assert.equal(r.left, -10);
  assert.equal(r.leftValue, 0);
});

const sample = () => ({
  plannedQty: 60,
  materials: [
    { qty: 100, price: 30000, perItem: 1.8 }, // 3 000 000
    { qty: 120, price: 500, perItem: 2, unit: 'dona' }, // tugma 60 000
  ],
  wsMode: 'split', cutPerItem: 5000, sewPerItem: 20000, wsPaid: 1_000_000,
  expenses: [{ amount: 100_000 }],
  receipts: [{ qty: 30 }, { qty: 20 }],
  markupType: '%', markupValue: 25,
  sales: [{ qty: 40, price: 100000, date: '2026-11-03' }],
});

test('fason: haqiqiy qabul qilingan son bo\'yicha tannarx va foyda', () => {
  const s = modelSummary(sample());
  assert.equal(s.qty, 50); // sexdan olingan
  assert.equal(s.isActual, true);
  assert.equal(s.materialsTotal, 3_060_000);
  assert.equal(s.workshopTotal, 50 * 25000);
  assert.equal(s.totalCost, 3_060_000 + 1_250_000 + 100_000);
  assert.equal(s.unitCost, 4_410_000 / 50); // 88 200
  assert.equal(s.price, 88200 * 1.25);
  assert.equal(s.possibleOutput, 55);
  assert.equal(s.stock, 10);
  assert.equal(s.revenue, 4_000_000);
  assert.equal(s.profitSold, 4_000_000 - 40 * 88200);
  assert.equal(s.wsDebt, 250_000);
});

test('fason: tovar olinmaguncha reja bo\'yicha', () => {
  const m = sample();
  m.receipts = [];
  m.wsMode = 'total'; m.servicePerItem = 22000;
  const s = modelSummary(m);
  assert.equal(s.qty, 60);
  assert.equal(s.isActual, false);
  assert.equal(s.workshopTotal, 60 * 22000);
});

test('marja summa ko\'rinishida', () => {
  const m = sample();
  m.markupType = 'sum'; m.markupValue = 15000;
  assert.equal(modelSummary(m).price, 88200 + 15000);
});

test('bo\'sh fason xatoliksiz', () => {
  const s = modelSummary({});
  assert.equal(s.unitCost, 0);
  assert.equal(s.possibleOutput, null);
});

test('oylik hisobot: toza foyda = sotuvdan foyda − oylik rasxod', () => {
  const state = {
    models: [sample()],
    overhead: [{ month: '2026-11', amount: 500_000 }, { month: '2026-10', amount: 999 }],
  };
  const r = monthReport(state, '2026-11');
  assert.equal(r.revenue, 4_000_000);
  assert.equal(r.cogs, 40 * 88200);
  assert.equal(r.overhead, 500_000);
  assert.equal(r.netProfit, 4_000_000 - 40 * 88200 - 500_000);
});
