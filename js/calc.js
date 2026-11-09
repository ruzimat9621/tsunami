// Barcha hisob-kitoblar shu faylda. DOM ga bog'liq emas — testlanadi.

export function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function sum(arr, f) {
  return (arr || []).reduce((s, x) => s + f(x), 0);
}

export const receivedQty = (m) => sum(m.receipts, (r) => num(r.qty));
export const soldQty = (m) => sum(m.sales, (s) => num(s.qty));

// Hisob uchun asosiy son: sexdan olingan bo'lsa — haqiqiy son, aks holda reja.
export function baseQty(m) {
  const r = receivedQty(m);
  return r > 0 ? r : num(m.plannedQty);
}

// Sexning 1 dona uchun narxi
export function workshopPerItem(m) {
  if (m.wsMode === 'total') return num(m.servicePerItem);
  return num(m.cutPerItem) + num(m.sewPerItem);
}

// Bitta material qatori: jami narx, nechta chiqadi, qancha ishlatildi, qancha qoldi
export function materialRow(mat, qty) {
  const amount = num(mat.qty);
  const price = num(mat.price);
  const per = num(mat.perItem);
  const total = amount * price;
  const possible = per > 0 ? Math.floor(amount / per + 1e-9) : null;
  const used = per > 0 && qty > 0 ? qty * per : null;
  const left = used !== null ? amount - used : null;
  const leftValue = left !== null && left > 0 ? left * price : 0;
  return { amount, price, per, total, possible, used, left, leftValue };
}

export function salePrice(unitCost, markupType, markupValue) {
  const v = num(markupValue);
  if (markupType === 'sum') return unitCost + v;
  return unitCost * (1 + v / 100);
}

export function modelSummary(m) {
  const received = receivedQty(m);
  const planned = num(m.plannedQty);
  const qty = received > 0 ? received : planned;
  const isActual = received > 0;

  const rows = (m.materials || []).map((x) => ({ ...x, calc: materialRow(x, qty) }));
  const materialsTotal = sum(rows, (r) => r.calc.total);
  const leftValue = sum(rows, (r) => r.calc.leftValue);
  const possibles = rows.filter((r) => r.calc.possible !== null).map((r) => r.calc.possible);
  const possibleOutput = possibles.length ? Math.min(...possibles) : null;

  const wsItem = workshopPerItem(m);
  const cutTotal = m.wsMode === 'total' ? 0 : qty * num(m.cutPerItem);
  const sewTotal = m.wsMode === 'total' ? 0 : qty * num(m.sewPerItem);
  const workshopTotal = qty * wsItem;
  const otherTotal = sum(m.expenses, (e) => num(e.amount));
  const totalCost = materialsTotal + workshopTotal + otherTotal;

  const unitCost = qty > 0 ? totalCost / qty : 0;
  const unitCostNet = qty > 0 ? (totalCost - leftValue) / qty : 0;
  const unitMaterial = qty > 0 ? materialsTotal / qty : 0;
  const unitOther = qty > 0 ? otherTotal / qty : 0;

  const price = salePrice(unitCost, m.markupType, m.markupValue);
  const unitProfit = price - unitCost;

  const sold = soldQty(m);
  const revenue = sum(m.sales, (s) => num(s.qty) * num(s.price));
  const stock = received - sold;
  const profitSold = revenue - unitCost * sold;
  const expectedProfit = price * qty - totalCost;
  const wsPaid = num(m.wsPaid);
  const wsDebt = workshopTotal - wsPaid;

  return {
    received, planned, qty, isActual, rows,
    materialsTotal, leftValue, possibleOutput,
    wsItem, cutTotal, sewTotal, workshopTotal, otherTotal, totalCost,
    unitCost, unitCostNet, unitMaterial, unitOther,
    price, unitProfit, sold, revenue, stock, profitSold, expectedProfit,
    wsPaid, wsDebt,
  };
}

const inMonth = (date, ym) => typeof date === 'string' && date.startsWith(ym);

// Oylik hisobot: shu oydagi sotuvlar, sotilgan tovar tannarxi, oylik rasxodlar, toza foyda
export function monthReport(state, ym) {
  let revenue = 0, cogs = 0, soldCount = 0, purchases = 0, otherSpent = 0;
  for (const m of state.models || []) {
    const s = modelSummary(m);
    for (const sale of m.sales || []) {
      if (!inMonth(sale.date, ym)) continue;
      const q = num(sale.qty);
      revenue += q * num(sale.price);
      cogs += q * s.unitCost;
      soldCount += q;
    }
    for (const mat of m.materials || []) {
      if (inMonth(mat.date, ym)) purchases += num(mat.qty) * num(mat.price);
    }
    for (const e of m.expenses || []) {
      if (inMonth(e.date, ym)) otherSpent += num(e.amount);
    }
  }
  const overheadItems = (state.overhead || []).filter((o) => o.month === ym);
  const overhead = sum(overheadItems, (o) => num(o.amount));
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - overhead;
  return { revenue, cogs, soldCount, grossProfit, overhead, overheadItems, netProfit, purchases, otherSpent };
}
