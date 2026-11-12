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

// O'tkazish koeffitsienti: 1 kg = necha metr, 1 pachka = necha dona
export function unitFactor(mat) {
  if (mat.unit === 'kg') return num(mat.metersPerKg);
  if (mat.unit === 'pachka') return num(mat.perPack);
  return 0;
}

// Sarf qaysi birlikda o'lchanadi: kg → metr, pachka → dona (koeffitsient kiritilgan bo'lsa)
export function consumptionUnit(mat) {
  if (mat.unit === 'kg') return num(mat.metersPerKg) > 0 ? 'm' : 'kg';
  if (mat.unit === 'pachka') return num(mat.perPack) > 0 ? 'dona' : 'pachka';
  return mat.unit || 'm';
}

// Asosiy mato — qism (tepa, ishton) soni shundan hisoblanadi. Astar, dublerin — yordamchi.
export const isMain = (mat) => mat.kind !== 'aks' && mat.role !== 'yordamchi';
const norm = (t) => String(t || '').trim().toLowerCase();

// Bitta material/aksessuar: jami narx, mavjud miqdor, nechta chiqadi, qancha ishlatildi, qancha qoldi
export function materialRow(mat, qty) {
  const amount = num(mat.qty);
  const price = num(mat.price);
  const total = amount * price;
  const factor = unitFactor(mat);
  const available = factor > 0 ? amount * factor : amount;
  const per = perItem(mat);
  const unitPrice = available > 0 ? total / available : 0; // sarf birligi narxi
  const perCost = per * unitPrice; // 1 ta kiyimga shu materialdan ketadigan pul
  const possible = per > 0 ? Math.floor(available / per + 1e-9) : null;
  // Sex shu materialdan nechta chiqarib bergani yozilgan bo'lsa — qoldiq haqiqiy son bo'yicha
  const produced = num(mat.producedQty);
  const actual = produced > 0;
  const usedFor = actual ? produced : qty;
  const used = per > 0 && usedFor > 0 ? usedFor * per : null;
  const left = used !== null ? available - used : null;
  const leftValue = left !== null && left > 0 ? left * unitPrice : 0;
  return { amount, price, total, available, unit: consumptionUnit(mat), unitPrice, per, perCost, possible, produced, actual, used, left, leftValue };
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

// Tayyor qismlar: har bir asosiy matodan sex chiqargan son, qism (tepa, ishton) bo'yicha yig'indi.
// 1 dona qism narxi = asosiy mato sarfi + shu qismga ketgan yordamchi mato (astar) sarfi.
export function partsReport(rows) {
  const aux = rows.filter((r) => r.kind !== 'aks' && !isMain(r));
  const map = new Map();
  for (const r of rows) {
    if (!isMain(r) || !(num(r.producedQty) > 0)) continue;
    for (const p of r.parts || []) {
      if (!(num(p.per) > 0)) continue;
      const key = norm(p.name) || "to'liq";
      let unitCost = num(p.per) * r.calc.unitPrice;
      for (const a of aux) {
        if (a.colorwayId && a.colorwayId !== r.colorwayId) continue;
        for (const ap of a.parts || []) if (norm(ap.name) === key) unitCost += num(ap.per) * a.calc.unitPrice;
      }
      if (!map.has(key)) map.set(key, { name: p.name || "To'liq", total: 0, cost: 0, lines: [] });
      const e = map.get(key);
      const count = num(r.producedQty);
      e.total += count;
      e.cost += count * unitCost;
      e.lines.push({ mat: r, colorwayId: r.colorwayId || '', count, unitCost });
    }
  }
  const parts = [...map.values()].map((e) => ({ ...e, unitCost: e.total ? e.cost / e.total : 0 }));
  const komplekt = parts.length ? Math.min(...parts.map((e) => e.total)) : null;
  return { parts, komplekt };
}

const minPossible = (rows) => {
  const lim = rows.filter((r) => r.calc.possible !== null);
  if (!lim.length) return { possible: null, limiting: null };
  const limiting = lim.reduce((a, b) => (b.calc.possible < a.calc.possible ? b : a));
  return { possible: limiting.calc.possible, limiting };
};

// Fason hisobi. Rasvetkaning o'z materiallari bo'lsa — har bir rasvetka alohida guruh bo'lib hisoblanadi.
// colorwayId bo'sh materiallar "umumiy" (hamma rasvetkalar uchun, masalan tugma, zamok).
export function modelSummary(m) {
  const all = (m.materials || []).map((x) => ({ ...x }));
  const cws = m.colorways || [];
  const receipts = m.receipts || [];
  const received = receivedQty(m);
  const planned = num(m.plannedQty);

  let groups = cws
    .map((cw, i) => ({ id: cw.id, cw, index: i, name: cw.color || `Rasvetka ${i + 1}`, mats: all.filter((x) => x.colorwayId && x.colorwayId === cw.id) }))
    .filter((g) => g.mats.length);
  const split = groups.length > 0;
  const inGroup = new Set(groups.flatMap((g) => g.mats));
  const shared = split ? all.filter((x) => !inGroup.has(x)) : [];
  if (!split) groups = [{ id: '', cw: null, index: -1, name: '', mats: all }];

  // Tayyor qismlar va komplekt (sex har materialdan nechta chiqargani bo'yicha)
  for (const x of all) x.calc = materialRow(x, 0);
  const { parts, komplekt: komplektAuto } = partsReport(all);

  // Har bir guruh uchun son: sexdan olingan (qo'lda) → qismlardan avtomatik komplekt → reja → materialdan chiqadigan
  for (const g of groups) {
    const pre = g.mats.map((x) => ({ ...x, calc: materialRow(x, 0) }));
    Object.assign(g, minPossible(pre));
    g.received = split ? sum(receipts.filter((r) => r.colorwayId === g.id), (r) => num(r.qty)) : received;
    g.planned = split ? num(g.cw.plannedQty) : planned;
    g.produced = split ? partsReport(g.mats).komplekt : komplektAuto;
    if (g.received > 0) { g.qty = g.received; g.basis = 'received'; }
    else if (g.produced) { g.qty = g.produced; g.basis = 'produced'; }
    else if (g.planned > 0) { g.qty = g.planned; g.basis = 'planned'; }
    else if (g.possible) { g.qty = g.possible; g.basis = 'auto'; }
    else { g.qty = 0; g.basis = 'none'; }
  }
  const scaleGroups = (target, basis) => {
    const base = sum(groups, (g) => g.qty);
    for (const g of groups) {
      g.qty = base > 0 ? (target * g.qty) / base : (g === groups[0] ? target : 0);
      if (basis) g.basis = basis;
    }
  };
  if (split) {
    const tagged = sum(groups, (g) => g.received);
    if (received > 0 && tagged === 0) scaleGroups(received, 'received'); // jami son qo'lda, rasvetkasiz
    else if (!received && komplektAuto && sum(groups, (g) => g.qty) > komplektAuto && groups.every((g) => g.basis === 'produced')) scaleGroups(komplektAuto);
  }
  const qty = sum(groups, (g) => g.qty);
  const basisSet = new Set(groups.filter((g) => g.qty > 0).map((g) => g.basis));
  const basis = !qty ? 'none' : basisSet.size === 1 ? [...basisSet][0] : 'mixed';

  // Material qatorlari: guruh materiallari o'z soni bilan, umumiylari jami son bilan
  const qtyOf = new Map();
  for (const g of groups) for (const x of g.mats) qtyOf.set(x, g.qty);
  for (const x of shared) qtyOf.set(x, qty);
  const rows = all.map((x) => Object.assign(x, { calc: materialRow(x, qtyOf.get(x) || 0) }));
  for (const g of groups) g.rows = g.mats;
  const sharedRows = shared;

  const shareLim = minPossible(sharedRows);
  let possibleOutput, limiting;
  if (!split) ({ possible: possibleOutput, limiting } = groups[0]);
  else {
    const gp = groups.filter((g) => g.possible !== null);
    possibleOutput = gp.length ? sum(gp, (g) => g.possible) : null;
    limiting = null;
    if (shareLim.possible !== null && (possibleOutput === null || shareLim.possible < possibleOutput)) {
      possibleOutput = shareLim.possible;
      limiting = shareLim.limiting;
    }
  }

  const fabrics = rows.filter((r) => r.kind !== 'aks');
  const accessories = rows.filter((r) => r.kind === 'aks');
  const fabricTotal = sum(fabrics, (r) => r.calc.total);
  const accTotal = sum(accessories, (r) => r.calc.total);
  const materialsTotal = fabricTotal + accTotal;
  const sharedTotal = sum(sharedRows, (r) => r.calc.total);
  const leftValue = sum(rows, (r) => r.calc.leftValue);

  const wsLines = (m.wsLines || []).map((l) => ({ ...l, total: num(l.price) * qty }));
  const wsItem = sum(wsLines, (l) => num(l.price));
  const workshopTotal = wsItem * qty;

  const services = (m.services || []).map((s) => ({ ...s, total: serviceTotal(s, qty) }));
  const servicesTotal = sum(services, (s) => s.total);
  const svcPerItem = sum(services.filter((s) => s.mode !== 'jami'), (s) => num(s.price));
  const svcFixed = sum(services.filter((s) => s.mode === 'jami'), (s) => num(s.price));

  // Qo'shimcha bir martalik harajatlar (arava, taksi, yuk tashish...)
  const extras = m.extras || [];
  const extrasTotal = sum(extras, (e) => num(e.amount));

  const totalCost = materialsTotal + workshopTotal + servicesTotal + extrasTotal;
  const per = (v) => (qty > 0 ? v / qty : 0);
  const unitCost = per(totalCost);
  const unitCostNet = per(totalCost - leftValue);
  const price = salePrice(unitCost, m.markupType, m.markupValue);

  // Har bir rasvetka (guruh) tannarxi: o'z materiali + sex + xizmat + umumiy materialning ulushi
  for (const g of groups) {
    g.ownTotal = sum(g.rows, (r) => r.calc.total);
    g.share = qty > 0 ? g.qty / qty : 0;
    g.cost = g.ownTotal + g.qty * (wsItem + svcPerItem) + (sharedTotal + svcFixed + extrasTotal) * g.share;
    g.unitCost = g.qty > 0 ? g.cost / g.qty : 0;
    g.price = salePrice(g.unitCost, m.markupType, m.markupValue);
    g.unitProfit = g.price - g.unitCost;
    g.expectedProfit = g.price * g.qty - g.cost;
  }
  const byGroup = new Map(groups.map((g) => [g.id, g]));
  const unitCostFor = (colorwayId) => (split && byGroup.has(colorwayId) ? byGroup.get(colorwayId).unitCost : unitCost);

  const sold = soldQty(m);
  const revenue = sum(m.sales, (s) => num(s.qty) * num(s.price));
  const stock = received - sold;
  const profitSold = sum(m.sales, (s) => num(s.qty) * (num(s.price) - unitCostFor(s.colorwayId)));
  const expectedProfit = sum(groups, (g) => g.expectedProfit);
  const unitProfit = qty > 0 ? expectedProfit / qty : price - unitCost;
  const wsPaid = num(m.wsPaid);
  const wsDebt = workshopTotal - wsPaid;
  const tagged = split ? sum(groups, (g) => g.received) : 0;
  const untaggedReceipts = split && tagged > 0 ? received - tagged : 0;

  // Rasvetka bo'yicha ombor qoldig'i (tovar sexdan olingan bo'lsa)
  const cwStock = new Map();
  if (split && received > 0) {
    for (const g of groups) {
      const soldG = sum((m.sales || []).filter((x) => x.colorwayId === g.id), (x) => num(x.qty));
      cwStock.set(g.id, { received: g.qty, sold: soldG, stock: g.qty - soldG });
    }
  }
  // Kassa uchun: rasvetka sotuv narxi
  const priceFor = (colorwayId) => (split && byGroup.has(colorwayId) ? byGroup.get(colorwayId).price : price);

  return {
    received, planned, qty, basis, isActual: basis === 'received',
    split, groups, sharedRows, sharedTotal, sharedPossible: shareLim.possible, untaggedReceipts,
    parts, komplektAuto,
    rows, fabrics, accessories, fabricTotal, accTotal, materialsTotal, leftValue,
    possibleOutput, limiting, unitCostFor, priceFor, cwStock,
    wsLines, wsItem, workshopTotal, services, servicesTotal, extras, extrasTotal, totalCost,
    unitCost, unitCostNet,
    unitFabric: per(fabricTotal), unitAcc: per(accTotal), unitServices: per(servicesTotal),
    price, unitProfit, sold, revenue, stock, profitSold, expectedProfit,
    wsPaid, wsDebt,
  };
}

const inMonth = (date, ym) => typeof date === 'string' && date.startsWith(ym);

// Oylik hisobot: shu oydagi sotuvlar, sotilgan tovar tannarxi, oylik rasxodlar, toza foyda
export function monthReport(state, ym) {
  let revenue = 0, cogs = 0, soldCount = 0, purchases = 0, extraSpent = 0;
  for (const m of state.models || []) {
    const s = modelSummary(m);
    for (const sale of m.sales || []) {
      if (!inMonth(sale.date, ym)) continue;
      const q = num(sale.qty);
      revenue += q * num(sale.price);
      cogs += q * s.unitCostFor(sale.colorwayId);
      soldCount += q;
    }
    for (const mat of m.materials || []) {
      if (inMonth(mat.date, ym)) purchases += num(mat.qty) * num(mat.price);
    }
    for (const e of m.extras || []) {
      if (inMonth(e.date, ym)) extraSpent += num(e.amount);
    }
  }
  const overheadItems = (state.overhead || []).filter((o) => o.month === ym);
  const overhead = sum(overheadItems, (o) => num(o.amount));
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - overhead;
  return { revenue, cogs, soldCount, grossProfit, overhead, overheadItems, netProfit, purchases, extraSpent };
}
