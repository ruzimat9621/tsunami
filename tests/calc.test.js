import { test } from 'node:test';
import assert from 'node:assert/strict';
import { num, modelSummary, materialRow, monthReport, salePrice } from '../js/calc.js';
import { normalize } from '../js/store.js';

test('num vergul va bo\'shliqlarni tushunadi', () => {
  assert.equal(num('1,8'), 1.8);
  assert.equal(num('45 000'), 45000);
  assert.equal(num(''), 0);
  assert.equal(num('abc'), 0);
});

test('mato: qismlar bo\'yicha sarf (tepa 1,7 + ishton 1) → nechta chiqadi', () => {
  const r = materialRow({ unit: 'm', qty: 100, price: 30000, parts: [{ name: 'Tepa', per: 1.7 }, { name: 'Ishton', per: 1 }] }, 0);
  assert.equal(r.total, 3_000_000);
  assert.equal(r.per, 2.7);
  assert.equal(r.possible, 37); // 100 / 2.7 = 37.03
  assert.equal(r.perCost, 2.7 * 30000);
  assert.equal(r.used, null);
});

test('mato kg da: 1 kg = 3 m kiritilsa sarf metrda hisoblanadi', () => {
  const r = materialRow({ unit: 'kg', qty: 20, price: 90000, metersPerKg: 3, parts: [{ per: 1.5 }] }, 30);
  assert.equal(r.unit, 'm');
  assert.equal(r.available, 60);
  assert.equal(r.possible, 40);
  assert.equal(r.used, 45);
  assert.equal(r.left, 15);
  assert.equal(r.perCost, 1.5 * 30000); // 1 m = 90000/3
  assert.equal(r.leftValue, 15 * 30000);
});

test('mato kg da, metr kiritilmasa sarf kg da', () => {
  const r = materialRow({ unit: 'kg', qty: 10, price: 80000, parts: [{ per: 0.4 }] }, 0);
  assert.equal(r.unit, 'kg');
  assert.equal(r.possible, 25);
});

test('material yetmasa minus qoladi', () => {
  const r = materialRow({ qty: 50, price: 1000, parts: [{ per: 1.5 }] }, 40);
  assert.equal(r.left, -10);
  assert.equal(r.leftValue, 0);
});

test('sotuv narxi: foiz, summa, to\'g\'ridan-to\'g\'ri narx', () => {
  assert.equal(salePrice(100000, '%', 25), 125000);
  assert.equal(salePrice(100000, 'sum', 15000), 115000);
  assert.equal(salePrice(100000, 'price', 140000), 140000);
});

const sample = () => ({
  materials: [
    { kind: 'mato', unit: 'm', qty: 100, price: 30000, parts: [{ name: "To'liq", per: 1.8 }] }, // 3 000 000, 55 dona
    { kind: 'aks', unit: 'dona', qty: 120, price: 500, parts: [{ name: 'Tepa', per: 2 }] }, // 60 000, 60 dona
  ],
  wsLines: [{ name: 'Bichuv', price: 5000 }, { name: 'Tikuv', price: 20000 }],
  services: [{ name: 'Dazmol', price: 1000, mode: 'dona' }, { name: 'Dostavka', price: 100_000, mode: 'jami' }],
  wsPaid: 1_000_000,
  receipts: [{ qty: 30 }, { qty: 20 }],
  markupType: '%', markupValue: 25,
  sales: [{ qty: 40, price: 100000, date: '2026-11-03' }],
});

test('fason: sexdan olingan son bo\'yicha tannarx va foyda', () => {
  const s = modelSummary(sample());
  assert.equal(s.qty, 50);
  assert.equal(s.basis, 'received');
  assert.equal(s.possibleOutput, 55);
  assert.equal(s.limiting.kind, 'mato');
  assert.equal(s.fabricTotal, 3_000_000);
  assert.equal(s.accTotal, 60_000);
  assert.equal(s.workshopTotal, 50 * 25000);
  assert.equal(s.servicesTotal, 50 * 1000 + 100_000);
  const total = 3_060_000 + 1_250_000 + 150_000;
  assert.equal(s.totalCost, total);
  assert.equal(s.unitCost, total / 50);
  assert.equal(s.price, (total / 50) * 1.25);
  assert.equal(s.stock, 10);
  assert.equal(s.profitSold, 4_000_000 - 40 * (total / 50));
  assert.equal(s.wsDebt, 250_000);
});

test('fason: tovar olinmasa va reja bo\'lmasa — materialdan chiqadigan son bo\'yicha', () => {
  const m = sample();
  m.receipts = [];
  const s = modelSummary(m);
  assert.equal(s.basis, 'auto');
  assert.equal(s.qty, 55);
  assert.equal(s.workshopTotal, 55 * 25000);
});

test('fason: reja kiritilsa reja bo\'yicha', () => {
  const m = sample();
  m.receipts = []; m.plannedQty = 40;
  assert.equal(modelSummary(m).qty, 40);
});

test('bo\'sh fason xatoliksiz', () => {
  const s = modelSummary({});
  assert.equal(s.unitCost, 0);
  assert.equal(s.possibleOutput, null);
  assert.equal(s.basis, 'none');
});

test('oylik hisobot: toza foyda = sotuvdan foyda − oylik rasxod', () => {
  const state = { models: [sample()], overhead: [{ month: '2026-11', amount: 500_000 }, { month: '2026-10', amount: 999 }] };
  const r = monthReport(state, '2026-11');
  const unit = modelSummary(sample()).unitCost;
  assert.equal(r.revenue, 4_000_000);
  assert.equal(r.cogs, 40 * unit);
  assert.equal(r.overhead, 500_000);
  assert.equal(r.netProfit, 4_000_000 - 40 * unit - 500_000);
});

test('eski versiya ma\'lumotlari yangi tuzilmaga o\'tadi', () => {
  const s = normalize({
    version: 1,
    models: [{
      id: 'a', name: 'Eski', photo: 'data:x', wsMode: 'split', cutPerItem: 5000, sewPerItem: 20000,
      materials: [{ unit: 'm', qty: 100, price: 1, perItem: 1.8 }, { unit: 'dona', qty: 10, price: 1, perItem: 2 }],
      expenses: [{ name: 'Taksi', amount: 50000 }],
    }],
  });
  const m = s.models[0];
  assert.equal(s.version, 2);
  assert.equal(m.colorways.length, 1);
  assert.equal(m.photo, undefined);
  assert.deepEqual(m.materials[0].parts, [{ name: "To'liq", per: 1.8 }]);
  assert.equal(m.materials[0].kind, 'mato');
  assert.equal(m.materials[1].kind, 'aks');
  assert.deepEqual(m.wsLines.map((l) => [l.name, l.price]), [['Bichuv', 5000], ['Tikuv', 20000]]);
  assert.equal(m.services[0].mode, 'jami');
  assert.equal(modelSummary(m).possibleOutput, 5);
});
