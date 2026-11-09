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

// 1 ta kiyimga sarf = barcha qismlar yig'indisi (tepa 1,7 + ishton 1 = 2,7)
export const perItem = (mat) => sum(mat.parts, (p) => num(p.per));

// Sarf qaysi birlikda o'lchanadi: kg bo'lib, "1 kg = necha metr" kiritilgan bo'lsa — metrda
export function consumptionUnit(mat) {
  if (mat.unit === 'kg') return num(mat.metersPerKg) > 0 ? 'm' : 'kg';
  return mat.unit || 'm';
}

// Bitta material/aksessuar: jami narx, mavjud miqdor, nechta chiqadi, qancha ishlatildi, qancha qoldi
export function materialRow(mat, qty) {
  const amount = num(mat.qty);
  const price = num(mat.price);
  const total = amount * price;
  const conv = mat.unit === 'kg' && num(mat.metersPerKg) > 0;
  const available = conv ? amount * num(mat.metersPerKg) : amount;
  const per = perItem(mat);
  const unitPrice = available > 0 ? total / available : 0; // sarf birligi narxi
  const perCost = per * unitPrice; // 1 ta kiyimga shu materialdan ketadigan pul
  const possible = per > 0 ? Math.floor(available / per + 1e-9) : null;
  const used = per > 0 && qty > 0 ? qty * per : null;
  const left = used !== null ? available - used : null;
  const leftValue = left !== null && left > 0 ? left * unitPrice : 0;
  return { amount, price, total, available, unit: consumptionUnit(mat), per, perCost, possible, used, left, leftValue };
}

// Sotuv narxi: foiz, tannarx ustiga summa yoki to'g'ridan-to'g'ri narx
export function salePrice(unitCost, markupType, markupValue) {
  const v = num(markupValue);
  if (markupType === 'price') return v;
  if (markupType === 'sum') return unitCost + v;
  return unitCost * (1 + v / 100);
}

export function serviceTotal(s, qty) {
  return s.mode === 'jami' ? num(s.price) : num(s.price) * qty;
}

export function modelSummary(m) {
  const received = receivedQty(m);
  const planned = num(m.plannedQty);

  const all = m.materials || [];
  const preRows = all.map((x) => ({ ...x, calc: materialRow(x, 0) }));
  const limits = preRows.filter((r) => r.calc.possible !== null);
  const possibleOutput = limits.length ? Math.min(...limits.map((r) => r.calc.possible)) : null;
  const limiting = limits.length ? limits.reduce((a, b) => (b.calc.possible < a.calc.possible ? b : a)) : null;

  // Hisob uchun son: sexdan olingan → reja → materialdan avtomatik chiqadigan
  let qty = 0, basis = 'none';
  if (received > 0) { qty = received; basis = 'received'; }
  else if (planned > 0) { qty = planned; basis = 'planned'; }
  else if (possibleOutput) { qty = possibleOutput; basis = 'auto'; }

  const rows = all.map((x) => ({ ...x, calc: materialRow(x, qty) }));
  const fabrics = rows.filter((r) => r.kind !== 'aks');
  const accessories = rows.filter((r) => r.kind === 'aks');
  const fabricTotal = sum(fabrics, (r) => r.calc.total);
  const accTotal = sum(accessories, (r) => r.calc.total);
  const materialsTotal = fabricTotal + accTotal;
  const leftValue = sum(rows, (r) => r.calc.leftValue);

  const wsLines = (m.wsLines || []).map((l) => ({ ...l, total: num(l.price) * qty }));
  const wsItem = sum(wsLines, (l) => num(l.price));
  const workshopTotal = wsItem * qty;

  const services = (m.services || []).map((s) => ({ ...s, total: serviceTotal(s, qty) }));
  const servicesTotal = sum(services, (s) => s.total);

  const totalCost = materialsTotal + workshopTotal + servicesTotal;
  const per = (v) => (qty > 0 ? v / qty : 0);
  const unitCost = per(totalCost);
  const unitCostNet = per(totalCost - leftValue);

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
    received, planned, qty, basis, isActual: basis === 'received',
    rows, fabrics, accessories, fabricTotal, accTotal, materialsTotal, leftValue,
    possibleOutput, limiting,
    wsLines, wsItem, workshopTotal, services, servicesTotal, totalCost,
    unitCost, unitCostNet,
    unitFabric: per(fabricTotal), unitAcc: per(accTotal), unitServices: per(servicesTotal),
    price, unitProfit, sold, revenue, stock, profitSold, expectedProfit,
    wsPaid, wsDebt,
  };
}

const inMonth = (date, ym) => typeof date === 'string' && date.startsWith(ym);

// Oylik hisobot: shu oydagi sotuvlar, sotilgan tovar tannarxi, oylik rasxodlar, toza foyda
export function monthReport(state, ym) {
  let revenue = 0, cogs = 0, soldCount = 0, purchases = 0;
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
  }
  const overheadItems = (state.overhead || []).filter((o) => o.month === ym);
  const overhead = sum(overheadItems, (o) => num(o.amount));
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - overhead;
  return { revenue, cogs, soldCount, grossProfit, overhead, overheadItems, netProfit, purchases };
}
