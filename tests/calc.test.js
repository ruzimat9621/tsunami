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

test('rasvetkalar alohida: bardo (tepa bardoviy + ishton choko + astar), qora; tugma umumiy', () => {
  const m = {
    colorways: [{ id: 'b', color: 'Bardo' }, { id: 'q', color: 'Qora' }, { id: 'x', color: 'Materialsiz' }],
    materials: [
      { colorwayId: 'b', kind: 'mato', name: 'Bardoviy', unit: 'kg', qty: 10, price: 90000, metersPerKg: 3, parts: [{ name: 'Tepa', per: 1.5 }] }, // 30 m → 20, 900 000
      { colorwayId: 'b', kind: 'mato', name: 'Choko', unit: 'm', qty: 25, price: 20000, parts: [{ name: 'Ishton', per: 1 }] }, // 25, 500 000
      { colorwayId: 'b', kind: 'mato', name: 'Astar', unit: 'm', qty: 20, price: 10000, parts: [{ name: 'Tepa', per: 0.8 }] }, // 25, 200 000
      { colorwayId: 'q', kind: 'mato', name: 'Qora', unit: 'm', qty: 50, price: 30000, parts: [{ name: "To'liq", per: 2.5 }] }, // 20, 1 500 000
      { kind: 'aks', name: 'Tugma', unit: 'dona', qty: 300, price: 500, parts: [{ name: 'Tepa', per: 6 }] }, // umumiy: 50, 150 000
    ],
    wsLines: [{ name: 'Usluga', price: 30000 }],
    services: [{ name: 'Dostavka', price: 200000, mode: 'jami' }],
    markupType: 'price', markupValue: 250000,
    receipts: [], sales: [{ qty: 10, price: 250000, colorwayId: 'b', date: '2026-11-05' }],
  };
  const s = modelSummary(m);
  assert.equal(s.split, true);
  assert.equal(s.groups.length, 2);
  const [b, q] = s.groups;
  assert.equal(b.possible, 20); // eng kam: bardoviy 20
  assert.equal(b.limiting.name, 'Bardoviy');
  assert.equal(q.possible, 20);
  assert.equal(s.possibleOutput, 40);
  assert.equal(s.qty, 40);
  assert.equal(s.sharedPossible, 50);
  // Bardo: 1 600 000 o'z materiali + 20*30000 sex + (150000 tugma + 200000 dostavka) * 0.5
  assert.equal(b.cost, 1_600_000 + 600_000 + 175_000);
  assert.equal(b.unitCost, 2_375_000 / 20);
  assert.equal(q.cost, 1_500_000 + 600_000 + 175_000);
  assert.equal(s.totalCost, b.cost + q.cost);
  assert.equal(b.price, 250000);
  assert.equal(s.profitSold, 10 * (250000 - b.unitCost));
  assert.equal(monthReport({ models: [m] }, '2026-11').cogs, 10 * b.unitCost);
});

test('rasvetka bo\'yicha qabul qilingan son ishlatiladi; umumiy material yetmasa cheklaydi', () => {
  const m = {
    colorways: [{ id: 'a' }, { id: 'c' }],
    materials: [
      { colorwayId: 'a', unit: 'm', qty: 100, price: 1, parts: [{ per: 2 }] },
      { colorwayId: 'c', unit: 'm', qty: 100, price: 1, parts: [{ per: 2 }] },
      { kind: 'aks', unit: 'dona', qty: 60, price: 1, parts: [{ per: 1 }] },
    ],
    receipts: [{ qty: 45, colorwayId: 'a' }],
  };
  const s = modelSummary(m);
  assert.equal(s.groups[0].qty, 45);
  assert.equal(s.groups[0].basis, 'received');
  assert.equal(s.groups[1].qty, 50);
  assert.equal(s.possibleOutput, 60); // 50+50=100, lekin zamok faqat 60 ga yetadi
  assert.equal(s.limiting.kind, 'aks');
});

test("qo'shimcha harajat (arava 20 000) tannarxga va rasvetkalarga taqsimlanadi", () => {
  const m = {
    colorways: [{ id: 'a' }, { id: 'b' }],
    materials: [
      { colorwayId: 'a', unit: 'm', qty: 30, price: 10000, parts: [{ per: 1 }] }, // 30 dona
      { colorwayId: 'b', unit: 'm', qty: 10, price: 10000, parts: [{ per: 1 }] }, // 10 dona
    ],
    extras: [{ name: 'Arava', amount: 20000, date: '2026-11-02' }, { name: 'Taksi', amount: 40000, date: '2026-10-30' }],
  };
  const s = modelSummary(m);
  assert.equal(s.extrasTotal, 60000);
  assert.equal(s.totalCost, 400_000 + 60_000);
  assert.equal(s.groups[0].cost, 300_000 + 60_000 * 0.75);
  assert.equal(s.groups[1].cost, 100_000 + 60_000 * 0.25);
  assert.equal(monthReport({ models: [m] }, '2026-11').extraSpent, 20000);
});
