import { loadState, saveState, uid, normalize } from './store.js';
import { num, sum, modelSummary, monthReport, materialRow, receivedQty, soldQty, salePrice } from './calc.js';

// ---------- Yordamchilar ----------
const $ = (sel) => document.querySelector(sel);
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const money = (v) => {
  const n = Math.round(num(v));
  return (n < 0 ? '-' : '') + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
};
const fmt = (v, d = 2) => {
  const n = Math.round(num(v) * 10 ** d) / 10 ** d;
  const [i, f] = Math.abs(n).toString().split('.');
  return (n < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : '');
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const thisMonth = () => today().slice(0, 7);
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const monthName = (ym) => { const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${y}`; };
const shiftMonth = (ym, d) => { const [y, m] = ym.split('-').map(Number); const t = new Date(y, m - 1 + d, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
const dateUz = (d) => (d ? d.split('-').reverse().join('.') : '');
const FABRIC_UNITS = { m: 'metr', kg: 'kg' };
const ACC_UNITS = { dona: 'dona', m: 'metr', pachka: 'pachka', kg: 'kg' };
const unitShort = (u) => ({ m: 'm', dona: 'dona', kg: 'kg', pachka: 'pachka' }[u] || u || '');
const STATUSES = { jarayonda: 'Jarayonda', sexda: 'Sexda tikilmoqda', sotuvda: 'Sotuvda', yopilgan: 'Yopilgan' };
const PARTS = ["To'liq", 'Tepa', 'Ishton', 'Yubka', 'Yeng', 'Yoqa', 'Astar', 'Kapyushon', "Cho'ntak", 'Manjet', 'Bel'];
const WS_TYPES = ["Usluga (to'liq)", 'Bichuv', 'Tikuv', 'Overlok', 'Raskroy', 'Boshqa'];
const SERVICES = ['Dazmol', 'Upakovka', 'Dostavka', 'Print', 'Vishivka', 'Petlya', 'Tugma qadash', 'Etiketka / birka', 'OTK (tekshiruv)', 'Taksi / transport'];
const ACCESSORIES = ['Tugma', 'Zamok', 'Rezinka', 'Lenta', 'Kant', 'Etiketka', 'Ip', 'Knopka', 'Lyuversa', 'Shnur'];
const telLink = (p) => (p ? `<a class="tel" href="tel:${h(String(p).replace(/[^\d+]/g, ''))}">📞 ${h(p)}</a>` : '');

let state = null;
const ui = { tab: {}, month: thisMonth(), search: '' };

async function commit() {
  await saveState(state);
  render();
}

const byId = (list, id) => state[list].find((x) => x.id === id);
const model = (id) => byId('models', id);
const cover = (m) => m.colorways?.[0]?.photo || '';

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- Forma (pastdan chiquvchi oyna) ----------
let currentForm = null;

const partRow = (p = {}) => `<div class="part-row">
  <input name="part_name" list="parts_list" value="${h(p.name ?? '')}" placeholder="Qism: tepa, ishton...">
  <input name="part_per" type="text" inputmode="decimal" autocomplete="off" value="${h(p.per ?? '')}" placeholder="0">
  <button type="button" class="icon-btn" data-act="del-part" aria-label="O'chirish">✕</button></div>`;

function fieldHtml(f, v) {
  if (f.type === 'hidden') return '';
  const val = v[f.name] ?? f.default ?? '';
  const req = f.required ? 'required' : '';
  const id = 'f_' + f.name;
  let input;
  if (f.type === 'select') {
    input = `<select id="${id}" name="${f.name}" ${req}>${f.options.map((o) =>
      `<option value="${h(o.value)}" ${String(o.value) === String(val) ? 'selected' : ''}>${h(o.label)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea id="${id}" name="${f.name}" rows="2" placeholder="${h(f.placeholder || '')}">${h(val)}</textarea>`;
  } else if (f.type === 'photo') {
    input = `<div class="photo-input ${f.big ? 'big' : ''}">
      <img id="${id}_prev" src="${h(val)}" ${val ? '' : 'hidden'} alt="">
      <input type="hidden" name="${f.name}" id="${id}" value="${h(val)}">
      <label class="btn ghost">📷 ${val ? 'Rasmni almashtirish' : 'Rasm tanlash'}<input type="file" accept="image/*" data-photo="${id}" hidden></label>
    </div>`;
  } else if (f.type === 'parts') {
    const rows = Array.isArray(val) && val.length ? val : [{ name: "To'liq", per: '' }];
    input = `<div class="parts" id="${id}">${rows.map(partRow).join('')}</div>
      <datalist id="parts_list">${PARTS.map((o) => `<option value="${h(o)}">`).join('')}</datalist>
      <button type="button" class="btn ghost sm" data-act="add-part">+ Qism qo'shish</button>`;
  } else if (f.type === 'number') {
    input = `<input id="${id}" name="${f.name}" type="text" inputmode="decimal" autocomplete="off" value="${h(val)}" placeholder="${h(f.placeholder || '0')}" ${req}>`;
  } else {
    const list = f.list ? `list="${id}_list"` : '';
    const dl = f.list ? `<datalist id="${id}_list">${f.list.map((o) => `<option value="${h(o)}">`).join('')}</datalist>` : '';
    input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" ${f.type === 'tel' ? 'inputmode="tel"' : ''} value="${h(val)}" placeholder="${h(f.placeholder || '')}" ${list} ${req}>${dl}`;
  }
  const label = typeof f.label === 'function' ? f.label(v) : f.label;
  return `<div class="field ${f.half ? 'half' : ''}" data-field="${f.name}"><label for="${id}" data-label="${f.name}">${h(label)}${f.suffix ? ` <small>(${h(f.suffix)})</small>` : ''}</label>${input}${f.hint ? `<small class="hint">${h(f.hint)}</small>` : ''}</div>`;
}

function openForm(cfg) {
  currentForm = cfg;
  const v = cfg.values || {};
  $('#sheet').innerHTML = `
    <div class="sheet-backdrop" data-act="close-form"></div>
    <form class="sheet-panel" id="sheet-form" novalidate>
      <div class="sheet-head"><h3>${h(cfg.title)}</h3><button type="button" class="icon-btn" data-act="close-form" aria-label="Yopish">✕</button></div>
      <div class="sheet-body"><div class="fields">${cfg.fields.map((f) => fieldHtml(f, v)).join('')}</div><div id="form-live" class="form-live"></div></div>
      <div class="sheet-foot">
        ${cfg.onDelete ? `<button type="button" class="btn danger" data-act="form-delete">O'chirish</button>` : ''}
        <button type="submit" class="btn primary">${h(cfg.submitText || 'Saqlash')}</button>
      </div>
    </form>`;
  $('#sheet').classList.add('open');
  document.body.classList.add('noscroll');
  updateLive();
}

function closeForm() {
  $('#sheet').classList.remove('open');
  $('#sheet').innerHTML = '';
  document.body.classList.remove('noscroll');
  currentForm = null;
}

function readForm() {
  const fd = new FormData($('#sheet-form'));
  const out = {};
  for (const f of currentForm.fields) {
    if (f.type === 'parts') {
      const names = fd.getAll('part_name');
      const pers = fd.getAll('part_per');
      out[f.name] = names.map((n, i) => ({ name: String(n).trim(), per: pers[i] === '' ? '' : num(pers[i]) }))
        .filter((p) => p.name || num(p.per) > 0);
      continue;
    }
    const raw = fd.get(f.name);
    out[f.name] = f.type === 'number' ? (raw === '' || raw === null ? '' : num(raw)) : (raw ?? '').toString().trim();
  }
  return out;
}

function updateLive() {
  if (!currentForm) return;
  const v = readForm();
  for (const f of currentForm.fields) {
    if (f.showIf) document.querySelector(`[data-field="${f.name}"]`).hidden = !f.showIf(v);
    if (typeof f.label === 'function') {
      const el = document.querySelector(`[data-label="${f.name}"]`);
      if (el) el.innerHTML = h(f.label(v)) + (f.suffix ? ` <small>(${h(f.suffix)})</small>` : '');
    }
  }
  if (currentForm.live) $('#form-live').innerHTML = currentForm.live(v) || '';
}

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'sheet-form') return;
  e.preventDefault();
  const vals = readForm();
  for (const f of currentForm.fields) {
    const hidden = f.showIf && !f.showIf(vals);
    if (f.required && !hidden && (vals[f.name] === '' || vals[f.name] === null)) {
      toast(`"${typeof f.label === 'function' ? f.label(vals) : f.label}" ni to'ldiring`);
      $('#f_' + f.name)?.focus();
      return;
    }
  }
  const cfg = currentForm;
  closeForm();
  await cfg.onSubmit(vals);
  await commit();
  toast('Saqlandi ✓');
});

document.addEventListener('input', (e) => {
  if (e.target.closest('#sheet-form')) updateLive();
  if (e.target.id === 'search') { ui.search = e.target.value; renderList(); }
});

document.addEventListener('change', async (e) => {
  const inp = e.target;
  if (inp.dataset.photo && inp.files?.[0]) {
    const data = await resizeImage(inp.files[0], 900);
    $('#' + inp.dataset.photo).value = data;
    const prev = $('#' + inp.dataset.photo + '_prev');
    prev.src = data; prev.hidden = false;
  }
  if (inp.dataset.colorways && inp.files?.length) {
    const m = model(inp.dataset.colorways);
    const files = [...inp.files];
    toast(`${files.length} ta rasm yuklanmoqda…`);
    for (const f of files) {
      try { m.colorways.push({ id: uid(), photo: await resizeImage(f, 900), color: '' }); } catch { /* rasm o'qilmadi */ }
    }
    await commit();
    toast(`${files.length} ta rasvetka qo'shildi. Rangini yozish uchun rasmni bosing.`);
  }
  if (inp.id === 'import-file' && inp.files?.[0]) importBackup(inp.files[0]);
  if (inp.closest('#sheet-form')) updateLive();
});

function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ---------- Formalar ----------
const shopOptions = () => [{ value: '', label: '— Do\'kon tanlang —' }, ...state.shops.map((s) => ({ value: s.id, label: s.name + (s.market ? ` (${s.market})` : '') })), { value: '__new', label: '+ Yangi do\'kon qo\'shish' }];
const wsOptions = () => [{ value: '', label: '— Sex tanlang —' }, ...state.workshops.map((s) => ({ value: s.id, label: s.name + (s.owner ? ` — ${s.owner}` : '') })), { value: '__new', label: '+ Yangi sex qo\'shish' }];
const allMaterials = () => state.models.flatMap((m) => m.materials);
const knownNames = (kind) => [...new Set(allMaterials().filter((x) => (x.kind === 'aks') === (kind === 'aks')).map((x) => x.name).filter(Boolean))];
const knownColors = () => [...new Set([...allMaterials().map((x) => x.color), ...state.models.flatMap((m) => m.colorways.map((c) => c.color))].filter(Boolean))];

function shopForm(shop, after) {
  openForm({
    title: shop ? "Do'konni tahrirlash" : "Yangi do'kon",
    values: shop,
    fields: [
      { name: 'name', label: "Do'kon nomi / sotuvchi", required: true, placeholder: 'Masalan: Abdulla aka mato' },
      { name: 'market', label: 'Bozor', placeholder: 'Masalan: Abu Saxiy', list: [...new Set(state.shops.map((s) => s.market).filter(Boolean))] },
      { name: 'address', label: 'Manzil (blok, qator, raqam)', placeholder: '3-blok, 12-qator, 45' },
      { name: 'phone', label: 'Telefon', type: 'tel', placeholder: '+998 90 123 45 67' },
      { name: 'phone2', label: "Qo'shimcha telefon", type: 'tel' },
      { name: 'note', label: 'Izoh', type: 'textarea', placeholder: 'Nima sotadi, narxlari, va h.k.' },
    ],
    onSubmit: (v) => {
      if (shop) Object.assign(shop, v);
      else { const s = { id: uid(), ...v }; state.shops.push(s); after?.(s); }
    },
    onDelete: shop ? () => {
      if (!confirm(`"${shop.name}" do'konini o'chirasizmi?`)) return false;
      state.shops = state.shops.filter((s) => s !== shop);
      location.hash = '#/shops';
    } : null,
  });
}

function workshopForm(ws, after) {
  openForm({
    title: ws ? 'Sexni tahrirlash' : 'Yangi sex',
    values: ws,
    fields: [
      { name: 'name', label: 'Sex nomi', required: true, placeholder: 'Masalan: Chilonzor sex' },
      { name: 'owner', label: 'Tikuvchi / mas\'ul ismi', placeholder: 'Ismi' },
      { name: 'address', label: 'Manzil', placeholder: 'Shahar, mahalla, ko\'cha, uy' },
      { name: 'phone', label: 'Telefon', type: 'tel', placeholder: '+998 ...' },
      { name: 'phone2', label: "Qo'shimcha telefon (bichuvchi va h.k.)", type: 'tel' },
      { name: 'note', label: 'Izoh', type: 'textarea' },
    ],
    onSubmit: (v) => {
      if (ws) Object.assign(ws, v);
      else { const s = { id: uid(), ...v }; state.workshops.push(s); after?.(s); }
    },
    onDelete: ws ? () => {
      if (!confirm(`"${ws.name}" sexini o'chirasizmi?`)) return false;
      state.workshops = state.workshops.filter((s) => s !== ws);
      location.hash = '#/workshops';
    } : null,
  });
}

function modelForm(m) {
  openForm({
    title: m ? 'Fasonni tahrirlash' : 'Yangi fason',
    values: m || { status: 'jarayonda', date: today() },
    fields: [
      { name: 'name', label: 'Fason nomi', required: true, placeholder: "Masalan: Ayollar kostyumi #12" },
      { name: 'code', label: 'Artikul / kod', half: true },
      { name: 'sizes', label: "O'lchamlar", half: true, placeholder: '42-50' },
      { name: 'date', label: 'Boshlangan sana', type: 'date', half: true },
      { name: 'status', label: 'Holati', type: 'select', half: true, options: Object.entries(STATUSES).map(([value, label]) => ({ value, label })) },
      { name: 'plannedQty', label: 'Reja: nechta tikiladi (ixtiyoriy)', type: 'number', suffix: 'dona', hint: "Bo'sh qoldirsangiz — materialdan nechta chiqishi avtomatik olinadi" },
      { name: 'note', label: 'Izoh', type: 'textarea' },
    ],
    onSubmit: (v) => {
      if (m) Object.assign(m, v);
      else {
        const nm = { id: uid(), colorways: [], materials: [], wsLines: [], services: [], receipts: [], sales: [], markupType: '%', markupValue: 30, ...v };
        state.models.unshift(nm);
        location.hash = '#/model/' + nm.id;
      }
    },
    onDelete: m ? () => {
      if (!confirm(`"${m.name}" fasonini va unga tegishli hamma yozuvlarni o'chirasizmi?`)) return false;
      state.models = state.models.filter((x) => x !== m);
      location.hash = '#/models';
    } : null,
  });
}

function colorwayForm(m, cw) {
  const idx = m.colorways.indexOf(cw);
  openForm({
    title: `Rasvetka ${idx + 1} / ${m.colorways.length}`,
    values: cw,
    fields: [
      { name: 'photo', label: 'Rasm', type: 'photo', big: true },
      { name: 'color', label: 'Rangi / nomi', list: knownColors(), placeholder: 'Masalan: Qora, Bej, Olivka' },
      { name: 'note', label: 'Izoh', type: 'textarea' },
    ],
    onSubmit: (v) => Object.assign(cw, v),
    onDelete: () => { if (!confirm("Bu rasvetkani o'chirasizmi?")) return false; m.colorways = m.colorways.filter((x) => x !== cw); },
  });
}

function materialForm(m, mat, kind = mat?.kind || 'mato') {
  const isAcc = kind === 'aks';
  const s = modelSummary(m);
  const unitOf = (v) => (v.unit === 'kg' ? (num(v.metersPerKg) > 0 ? 'm' : 'kg') : unitShort(v.unit));
  openForm({
    title: (mat ? 'Tahrirlash: ' : "Qo'shish: ") + (isAcc ? 'aksessuar / detal' : 'mato'),
    values: mat || { unit: isAcc ? 'dona' : 'm', date: today(), parts: [{ name: "To'liq", per: '' }] },
    fields: [
      { name: 'name', label: isAcc ? 'Aksessuar nomi' : 'Mato nomi', required: true, list: isAcc ? [...new Set([...ACCESSORIES, ...knownNames('aks')])] : knownNames('mato'), placeholder: isAcc ? 'Tugma, zamok, rezinka...' : 'Shtapel, krep, futer...' },
      { name: 'color', label: 'Rangi', half: true, list: knownColors(), placeholder: 'Qora, oq...' },
      { name: 'unit', label: "Narxi nimaga", type: 'select', half: true, options: Object.entries(isAcc ? ACC_UNITS : FABRIC_UNITS).map(([value, label]) => ({ value, label: label + 'ga' })) },
      { name: 'shopId', label: "Qaysi do'kondan", type: 'select', options: shopOptions() },
      { name: 'qty', label: (v) => `Olingan miqdor (${unitShort(v.unit)})`, type: 'number', required: true, half: true },
      { name: 'price', label: (v) => `1 ${unitShort(v.unit)} narxi`, type: 'number', required: true, half: true, suffix: "so'm" },
      { name: 'metersPerKg', label: '1 kg dan necha metr chiqadi', type: 'number', showIf: (v) => v.unit === 'kg', hint: "Ixtiyoriy. Kiritsangiz, sarfni metrda yozasiz (masalan 1 kg ≈ 3,2 m). Kiritmasangiz — sarf kg da." },
      { name: 'parts', label: (v) => `1 ta kiyimga sarfi (${unitOf(v)}) — qaysi qismga`, type: 'parts', hint: isAcc ? 'Masalan: Tepa — 6 (tugma), Ishton — 1 (zamok)' : "Masalan: Tepa — 1,7, Ishton — 1. Yoki To'liq — 2,7" },
      { name: 'date', label: 'Sana', type: 'date' },
      { name: 'note', label: 'Izoh', type: 'textarea', placeholder: 'Eni, sifati, partiya...' },
    ],
    live: (v) => {
      const r = materialRow(v, s.basis === 'auto' ? 0 : s.qty);
      const u = r.unit;
      let out = `<div class="live-row"><span>Jami narx</span><b>${money(r.total)}</b></div>`;
      if (v.unit === 'kg' && num(v.metersPerKg) > 0) out += `<div class="live-row"><span>Jami metraj</span><b>${fmt(r.available)} m</b></div>`;
      if (r.per > 0) {
        out += `<div class="live-row"><span>1 kiyimga sarf</span><b>${fmt(r.per)} ${u} · ${money(r.perCost)}</b></div>`;
        out += `<div class="live-row big"><span>Shundan chiqadi</span><b>${fmt(r.possible, 0)} dona</b></div>`;
        const rest = r.available - r.possible * r.per;
        out += `<div class="live-row"><span>Ortib qoladi</span><b>${fmt(rest)} ${u}</b></div>`;
        if (r.used !== null) {
          out += `<div class="live-row ${r.left < 0 ? 'neg' : ''}"><span>${s.isActual ? 'Olingan' : 'Rejadagi'} ${fmt(s.qty, 0)} donaga ${r.left < 0 ? 'yetishmaydi' : 'qoladi'}</span><b>${fmt(Math.abs(r.left))} ${u}</b></div>`;
        }
      }
      return out;
    },
    onSubmit: (v) => {
      if (v.unit !== 'kg') v.metersPerKg = '';
      v.kind = kind;
      const newShop = v.shopId === '__new';
      if (newShop) v.shopId = '';
      let target = mat;
      if (mat) Object.assign(mat, v); else { target = { id: uid(), ...v }; m.materials.push(target); }
      if (newShop) setTimeout(() => shopForm(null, (shop) => { target.shopId = shop.id; }), 50);
    },
    onDelete: mat ? () => {
      if (!confirm("O'chirasizmi?")) return false;
      m.materials = m.materials.filter((x) => x !== mat);
    } : null,
  });
}

function workshopPickForm(m) {
  openForm({
    title: 'Qaysi sexda tikiladi',
    values: m,
    fields: [
      { name: 'workshopId', label: 'Sex', type: 'select', options: wsOptions() },
      { name: 'wsPaid', label: "Sexga to'langan pul", type: 'number', suffix: "so'm" },
    ],
    onSubmit: (v) => {
      const isNew = v.workshopId === '__new';
      if (isNew) v.workshopId = '';
      Object.assign(m, v);
      if (isNew) setTimeout(() => workshopForm(null, (ws) => { m.workshopId = ws.id; }), 50);
    },
  });
}

function wsLineForm(m, line) {
  const q = modelSummary(m).qty;
  openForm({
    title: line ? 'Kelishuvni tahrirlash' : "Sex bilan kelishuv qo'shish",
    values: line || { name: WS_TYPES[0] },
    fields: [
      { name: 'name', label: 'Ish turi', required: true, list: WS_TYPES, hint: "Usluga (to'liq), bichuv, tikuv yoki boshqa — o'zingiz yozishingiz ham mumkin" },
      { name: 'price', label: '1 dona uchun narx', type: 'number', required: true, suffix: "so'm" },
      { name: 'note', label: 'Izoh', type: 'textarea' },
    ],
    live: (v) => `<div class="live-row"><span>${fmt(q, 0)} dona uchun</span><b>${money(num(v.price) * q)}</b></div>`,
    onSubmit: (v) => { if (line) Object.assign(line, v); else m.wsLines.push({ id: uid(), ...v }); },
    onDelete: line ? () => { if (!confirm("O'chirasizmi?")) return false; m.wsLines = m.wsLines.filter((x) => x !== line); } : null,
  });
}

function serviceForm(m, sv) {
  const q = modelSummary(m).qty;
  openForm({
    title: sv ? 'Xizmatni tahrirlash' : "Qo'shimcha xizmat qo'shish",
    values: sv || { mode: 'dona' },
    fields: [
      { name: 'name', label: 'Xizmat turi', required: true, list: SERVICES, placeholder: 'Dazmol, upakovka, dostavka, print...' },
      { name: 'mode', label: 'Narx qanday', type: 'select', options: [{ value: 'dona', label: '1 dona uchun' }, { value: 'jami', label: 'Umumiy summa (bir martalik)' }] },
      { name: 'price', label: (v) => (v.mode === 'jami' ? 'Umumiy summa' : '1 dona uchun narx'), type: 'number', required: true, suffix: "so'm" },
      { name: 'who', label: 'Kim qiladi (ixtiyoriy)', placeholder: 'Usta ismi, sex, firma' },
    ],
    live: (v) => {
      const total = v.mode === 'jami' ? num(v.price) : num(v.price) * q;
      return `<div class="live-row"><span>Jami (${fmt(q, 0)} dona)</span><b>${money(total)}</b></div>
        <div class="live-row"><span>1 donaga</span><b>${money(q ? total / q : 0)}</b></div>`;
    },
    onSubmit: (v) => { if (sv) Object.assign(sv, v); else m.services.push({ id: uid(), ...v }); },
    onDelete: sv ? () => { if (!confirm("O'chirasizmi?")) return false; m.services = m.services.filter((x) => x !== sv); } : null,
  });
}

function receiptForm(m, r) {
  openForm({
    title: r ? 'Qabulni tahrirlash' : 'Sexdan tayyor tovar olish',
    values: r || { date: today() },
    fields: [
      { name: 'qty', label: 'Nechta tayyor tovar oldingiz', type: 'number', required: true, suffix: 'dona' },
      { name: 'date', label: 'Sana', type: 'date' },
      { name: 'note', label: 'Izoh', type: 'textarea', placeholder: "Brak, rang/o'lcham bo'yicha taqsimot..." },
    ],
    onSubmit: (v) => { if (r) Object.assign(r, v); else m.receipts.push({ id: uid(), ...v }); },
    onDelete: r ? () => { if (!confirm("O'chirasizmi?")) return false; m.receipts = m.receipts.filter((x) => x !== r); } : null,
  });
}

function markupForm(m) {
  const s = modelSummary(m);
  openForm({
    title: 'Sotuv narxi',
    values: m,
    fields: [
      { name: 'markupType', label: 'Qanday belgilaysiz', type: 'select', options: [
        { value: 'price', label: "Sotuv narxini o'zim yozaman" },
        { value: 'sum', label: "Tannarx ustiga summa qo'yaman" },
        { value: '%', label: "Tannarx ustiga foiz qo'yaman" },
      ] },
      { name: 'markupValue', label: (v) => ({ price: '1 dona sotuv narxi', sum: "Ustiga qo'yiladigan summa (1 donaga)", '%': "Ustiga qo'yiladigan foiz" }[v.markupType || '%']), type: 'number', suffix: '' },
    ],
    live: (v) => {
      const price = salePrice(s.unitCost, v.markupType, v.markupValue);
      const unit = price - s.unitCost;
      return `<div class="live-row"><span>Tannarx (1 dona)</span><b>${money(s.unitCost)}</b></div>
        <div class="live-row"><span>Sotuv narxi</span><b>${money(price)}</b></div>
        <div class="live-row ${unit < 0 ? 'neg' : 'pos'}"><span>1 donadan foyda</span><b>${money(unit)}${s.unitCost ? ` (${fmt(unit / s.unitCost * 100, 1)}%)` : ''}</b></div>
        <div class="live-row big ${unit < 0 ? 'neg' : 'pos'}"><span>${fmt(s.qty, 0)} donadan foyda</span><b>${money(price * s.qty - s.totalCost)}</b></div>`;
    },
    onSubmit: (v) => Object.assign(m, v),
  });
}

function saleForm(m, sale) {
  const s = modelSummary(m);
  openForm({
    title: sale ? 'Sotuvni tahrirlash' : 'Sotuv yozish',
    values: sale || { date: today(), price: Math.round(s.price) },
    fields: [
      { name: 'qty', label: 'Nechta sotildi / topshirildi', type: 'number', required: true, half: true, suffix: 'dona' },
      { name: 'price', label: '1 dona narxi', type: 'number', required: true, half: true, suffix: "so'm" },
      { name: 'where', label: 'Kimga / qaysi do\'konga', list: [...new Set(state.models.flatMap((x) => x.sales.map((y) => y.where)).filter(Boolean))] },
      { name: 'date', label: 'Sana', type: 'date' },
      { name: 'note', label: 'Izoh', type: 'textarea' },
    ],
    live: (v) => {
      const rev = num(v.qty) * num(v.price);
      const pr = rev - num(v.qty) * s.unitCost;
      return `<div class="live-row"><span>Tushum</span><b>${money(rev)}</b></div>
        <div class="live-row ${pr < 0 ? 'neg' : 'pos'}"><span>Shu sotuvdan foyda</span><b>${money(pr)}</b></div>`;
    },
    onSubmit: (v) => { if (sale) Object.assign(sale, v); else m.sales.push({ id: uid(), ...v }); },
    onDelete: sale ? () => { if (!confirm("O'chirasizmi?")) return false; m.sales = m.sales.filter((x) => x !== sale); } : null,
  });
}

const OVERHEAD_NAMES = ['Ijara (sklad / do\'kon)', 'Ish haqi', 'Transport / benzin', 'Telefon / internet', 'Kommunal', 'Soliq', 'Reklama', 'Ovqat'];

function overheadForm(o) {
  openForm({
    title: o ? 'Oylik rasxodni tahrirlash' : "Oylik rasxod qo'shish",
    values: o || { month: ui.month },
    fields: [
      { name: 'name', label: 'Rasxod nomi', required: true, list: OVERHEAD_NAMES, placeholder: 'Masalan: Ijara' },
      { name: 'amount', label: 'Summa', type: 'number', required: true, suffix: "so'm" },
      { name: 'month', label: 'Oy', type: 'month' },
      { name: 'note', label: 'Izoh', type: 'textarea' },
    ],
    onSubmit: (v) => { if (!v.month) v.month = ui.month; if (o) Object.assign(o, v); else state.overhead.push({ id: uid(), ...v }); },
    onDelete: o ? () => { if (!confirm("O'chirasizmi?")) return false; state.overhead = state.overhead.filter((x) => x !== o); } : null,
  });
}

function recurringForm(r) {
  openForm({
    title: r ? 'Doimiy rasxodni tahrirlash' : "Doimiy (har oylik) rasxod",
    values: r,
    fields: [
      { name: 'name', label: 'Nomi', required: true, list: OVERHEAD_NAMES },
      { name: 'amount', label: 'Har oy summa', type: 'number', required: true, suffix: "so'm" },
    ],
    onSubmit: (v) => { if (r) Object.assign(r, v); else state.recurring.push({ id: uid(), ...v }); },
    onDelete: r ? () => { if (!confirm("O'chirasizmi?")) return false; state.recurring = state.recurring.filter((x) => x !== r); } : null,
  });
}

// ---------- Ko'rinishlar ----------
const statusChip = (st) => `<span class="chip st-${h(st)}">${h(STATUSES[st] || st)}</span>`;
const kv = (label, value, cls = '') => `<div class="kv ${cls}"><span>${label}</span><b>${value}</b></div>`;
const empty = (text, btn) => `<div class="empty"><p>${text}</p>${btn || ''}</div>`;
const thumb = (m, cls = '') => `<div class="thumb ${cls}">${cover(m) ? `<img src="${h(cover(m))}" alt="">` : '👗'}${m.colorways.length > 1 ? `<span class="badge">${m.colorways.length}</span>` : ''}</div>`;

function header(title, opts = {}) {
  return `<header class="top">
    ${opts.back ? `<a class="icon-btn" href="${opts.back}" aria-label="Orqaga">‹</a>` : '<span class="logo">✂️</span>'}
    <h1>${h(title)}</h1>
    ${opts.right || '<a class="icon-btn" href="#/settings" aria-label="Sozlamalar">⚙︎</a>'}
  </header>`;
}

function modelCard(m) {
  const s = modelSummary(m);
  return `<a class="card model-card" href="#/model/${m.id}">
    ${thumb(m)}
    <div class="mc-body">
      <div class="mc-top"><b>${h(m.name)}</b>${statusChip(m.status)}</div>
      <div class="mc-meta">${s.received ? `Olingan: ${fmt(s.received, 0)} · Sotilgan: ${fmt(s.sold, 0)} · Qoldiq: ${fmt(s.stock, 0)}` : (s.possibleOutput !== null ? `Materialdan chiqadi: ${fmt(s.possibleOutput, 0)} dona` : 'Material kiritilmagan')}</div>
      <div class="mc-nums"><span>Tannarx <b>${money(s.unitCost)}</b></span><span>Sotuv <b>${money(s.price)}</b></span></div>
    </div>
  </a>`;
}

function viewDashboard() {
  const ym = thisMonth();
  const r = monthReport(state, ym);
  const active = state.models.filter((m) => m.status !== 'yopilgan');
  let stockCount = 0, stockValue = 0, wsDebt = 0, totalProfit = 0;
  for (const m of state.models) {
    const s = modelSummary(m);
    stockCount += Math.max(0, s.stock);
    stockValue += Math.max(0, s.stock) * s.unitCost;
    if (s.wsDebt > 0) wsDebt += s.wsDebt;
    totalProfit += s.profitSold;
  }
  return header('Fason hisob') + `<main>
    <section class="card hero">
      <div class="hero-title">${monthName(ym)}</div>
      <div class="hero-big ${r.netProfit < 0 ? 'neg' : ''}">${money(r.netProfit)}</div>
      <div class="hero-sub">Oylik toza foyda (sotuvdan foyda − oylik rasxodlar)</div>
      <div class="grid2">
        ${kv('Sotuv tushumi', money(r.revenue))}
        ${kv('Sotuvdan foyda', money(r.grossProfit), r.grossProfit < 0 ? 'neg' : 'pos')}
        ${kv('Oylik rasxodlar', money(r.overhead), 'neg')}
        ${kv('Sotilgan', fmt(r.soldCount, 0) + ' dona')}
      </div>
      <a class="link" href="#/monthly">Oylik hisobotni ochish →</a>
    </section>
    <div class="quick">
      <button class="btn primary" data-act="new-model">+ Yangi fason</button>
      <button class="btn" data-act="new-overhead">+ Oylik rasxod</button>
    </div>
    <section class="card">
      <div class="grid2">
        ${kv('Ombordagi tovar', fmt(stockCount, 0) + ' dona')}
        ${kv('Ombor qiymati (tannarxda)', money(stockValue))}
        ${kv('Sexlarga qarz', money(wsDebt), wsDebt > 0 ? 'neg' : '')}
        ${kv('Jami sotuvdan foyda', money(totalProfit), 'pos')}
      </div>
    </section>
    <h2 class="sec">Faol fasonlar</h2>
    ${active.length ? active.map(modelCard).join('') : empty("Hali fason qo'shilmagan. Fason qo'shing → rasvetkalar → mato → aksessuar → sex → xizmatlar → sotuv narxi.", '<button class="btn primary" data-act="new-model">+ Yangi fason</button>')}
  </main>`;
}

function viewModels() {
  return header('Fasonlar') + `<main>
    <div class="toolbar"><input id="search" type="search" placeholder="Qidirish..." value="${h(ui.search)}"><button class="btn primary" data-act="new-model">+ Fason</button></div>
    <div id="list"></div>
  </main>`;
}

function renderList() {
  const el = $('#list');
  if (!el) return;
  const q = ui.search.toLowerCase();
  const items = state.models.filter((m) => !q || `${m.name} ${m.code || ''}`.toLowerCase().includes(q));
  el.innerHTML = items.length ? items.map(modelCard).join('') : empty(q ? 'Topilmadi' : "Hali fason yo'q", q ? '' : '<button class="btn primary" data-act="new-model">+ Yangi fason</button>');
}

function viewModel(id) {
  const m = model(id);
  if (!m) return header('Topilmadi', { back: '#/models' }) + empty('Fason topilmadi');
  const s = modelSummary(m);
  const tab = ui.tab[id] || 'hisob';
  const tabs = [['hisob', 'Hisob'], ['material', 'Material'], ['sex', 'Sex/Xizmat'], ['sotuv', 'Sotuv']];
  const body = { hisob: tabHisob, material: tabMaterial, sex: tabSex, sotuv: tabSotuv }[tab](m, s);
  const cws = m.colorways.map((c) => `<button class="cw" data-act="edit-colorway" data-id="${m.id}" data-sub="${c.id}">
      <img src="${h(c.photo)}" alt="" loading="lazy"><span>${h(c.color || 'rang?')}</span></button>`).join('');
  return header(m.name, { back: '#/models', right: `<button class="icon-btn" data-act="edit-model" data-id="${m.id}" aria-label="Tahrirlash">✎</button>` }) + `<main>
    <div class="model-meta">${statusChip(m.status)}${m.code ? `<span class="muted">Kod: ${h(m.code)}</span>` : ''}${m.sizes ? `<span class="muted">O'lcham: ${h(m.sizes)}</span>` : ''}${m.date ? `<span class="muted">${dateUz(m.date)}</span>` : ''}</div>
    <div class="sec-row"><h2 class="sec">Rasvetkalar · ${m.colorways.length} ta</h2></div>
    <div class="colorways">
      ${cws}
      <label class="cw cw-add"><span class="plus">＋</span><span>Rasm qo'shish</span><input type="file" accept="image/*" multiple data-colorways="${m.id}" hidden></label>
    </div>
    <nav class="tabs">${tabs.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-act="tab" data-id="${m.id}" data-tab="${k}">${l}</button>`).join('')}</nav>
    ${body}
  </main>`;
}

function basisText(s) {
  return {
    received: `Sexdan olingan <b>${fmt(s.qty, 0)} dona</b> bo'yicha`,
    planned: `Reja <b>${fmt(s.qty, 0)} dona</b> bo'yicha`,
    auto: `Materialdan chiqadigan <b>${fmt(s.qty, 0)} dona</b> bo'yicha`,
    none: 'Mato va sarfni kiriting — hisob avtomatik chiqadi',
  }[s.basis];
}

function tabHisob(m, s) {
  const lim = s.limiting;
  const line = (label, perUnit, total, cls = '') => `<div class="tr ${cls}"><span>${label}</span><span>${money(perUnit)}</span><b>${money(total)}</b></div>`;
  const q = s.qty || 1;
  return `
  <section class="card hero">
    <div class="grid2 hero-top">
      <div><div class="hero-title">Chiqadi</div><div class="hero-big">${s.possibleOutput !== null ? fmt(s.possibleOutput, 0) : '—'} <small>dona</small></div></div>
      <div><div class="hero-title">1 dona tannarxi</div><div class="hero-big">${money(s.unitCost)}</div></div>
    </div>
    <div class="hero-sub">${basisText(s)}${lim && s.rows.length > 1 ? `. Eng kam chiqaradigan: <b>${h(lim.name)}${lim.color ? ' ' + h(lim.color) : ''}</b>` : ''}</div>
    <div class="grid2">
      ${kv('Sotuv narxi', money(s.price))}
      ${kv('1 donadan foyda', money(s.unitProfit), s.unitProfit < 0 ? 'neg' : 'pos')}
    </div>
    <button class="btn ghost sm" data-act="markup" data-id="${m.id}">Sotuv narxini belgilash</button>
  </section>
  ${s.possibleOutput !== null && s.planned > s.possibleOutput ? `<div class="warn">Diqqat: material faqat <b>${fmt(s.possibleOutput, 0)} dona</b>ga yetadi, reja esa ${fmt(s.planned, 0)} dona.</div>` : ''}
  ${s.received > 0 && s.possibleOutput !== null && s.received < s.possibleOutput ? `<div class="info">Materialdan ${fmt(s.possibleOutput, 0)} dona chiqishi kerak edi, sexdan ${fmt(s.received, 0)} dona olindi (farq: ${fmt(s.possibleOutput - s.received, 0)}).</div>` : ''}

  <h2 class="sec">Hamma rasxodlar</h2>
  <section class="card table">
    <div class="th"><span></span><span>1 donaga</span><span>jami</span></div>
    ${line('Mato', s.unitFabric, s.fabricTotal)}
    ${line('Aksessuar / detal', s.unitAcc, s.accTotal)}
    ${s.wsLines.map((l) => line('Sex: ' + h(l.name), l.price, l.total)).join('') || line('Sex', 0, 0)}
    ${s.services.map((x) => line(h(x.name), x.total / q, x.total)).join('')}
    ${line('JAMI', s.unitCost, s.totalCost, 'total')}
  </section>

  <h2 class="sec">Foyda</h2>
  <section class="card grid2">
    ${kv(`Hammasi sotilsa (${fmt(s.qty, 0)} dona)`, money(s.expectedProfit), s.expectedProfit < 0 ? 'neg' : 'pos')}
    ${kv('Jami tushum bo\'ladi', money(s.price * s.qty))}
    ${kv('Sotilganlardan foyda', money(s.profitSold), s.profitSold < 0 ? 'neg' : 'pos')}
    ${kv('Sotildi / omborda', `${fmt(s.sold, 0)} / ${fmt(s.stock, 0)} dona`)}
  </section>
  ${s.leftValue > 0 ? `<div class="info">Ortib qolgan material qiymati: <b>${money(s.leftValue)}</b>. Uni boshqa ishga ishlatsangiz, 1 dona tannarx <b>${money(s.unitCostNet)}</b> bo'ladi.</div>` : ''}
  ${m.note ? `<div class="info">${h(m.note)}</div>` : ''}`;
}

function materialCard(m, r) {
  const c = r.calc;
  const shop = byId('shops', r.shopId);
  const u = c.unit;
  return `<div class="card item" data-act="edit-material" data-id="${m.id}" data-sub="${r.id}">
    <div class="item-top"><b>${h(r.name)}</b>${r.color ? `<span class="chip">${h(r.color)}</span>` : ''}<span class="grow"></span><b>${money(c.total)}</b></div>
    <div class="muted">${fmt(c.amount)} ${unitShort(r.unit)} × ${money(c.price)}${r.unit === 'kg' && num(r.metersPerKg) > 0 ? ` · ≈ ${fmt(c.available)} m` : ''}${r.date ? ' · ' + dateUz(r.date) : ''}</div>
    ${shop ? `<div class="muted">🏪 ${h(shop.name)}${shop.market ? ', ' + h(shop.market) : ''}</div>` : '<div class="muted small">Do\'kon tanlanmagan</div>'}
    ${c.per > 0 ? `<div class="parts-view">${(r.parts || []).filter((p) => num(p.per) > 0).map((p) => `<span>${h(p.name || 'Qism')}: <b>${fmt(p.per)} ${u}</b></span>`).join('')}</div>
    <div class="usage">
      <span>1 kiyimga: <b>${fmt(c.per)} ${u}</b></span>
      <span>Chiqadi: <b>${fmt(c.possible, 0)} dona</b></span>
      <span>1 donaga: <b>${money(c.perCost)}</b></span>
      ${c.used !== null ? `<span class="${c.left < 0 ? 'neg' : 'pos'}">${c.left < 0 ? 'Yetishmaydi' : 'Qoladi'}: <b>${fmt(Math.abs(c.left))} ${u}</b></span>` : `<span>Ortadi: <b>${fmt(c.available - c.possible * c.per)} ${u}</b></span>`}
    </div>` : `<div class="warn small">1 ta kiyimga sarfi kiritilmagan — bosib kiriting</div>`}
  </div>`;
}

function tabMaterial(m, s) {
  return `
    <div class="sec-row"><h2 class="sec">Matolar · ${money(s.fabricTotal)}</h2><button class="btn primary sm" data-act="add-material" data-id="${m.id}" data-kind="mato">+ Mato</button></div>
    ${s.fabrics.map((r) => materialCard(m, r)).join('') || empty("Bozordan olgan matolaringizni yozing: nomi, rangi, kg yoki metr narxi, qaysi do'kondan va kiyimning qaysi qismiga qancha ketishi.")}
    <div class="sec-row"><h2 class="sec">Aksessuar va detallar · ${money(s.accTotal)}</h2><button class="btn primary sm" data-act="add-material" data-id="${m.id}" data-kind="aks">+ Aksessuar</button></div>
    ${s.accessories.map((r) => materialCard(m, r)).join('') || empty('Tugma, zamok, rezinka, lenta, etiketka va boshqalar.')}`;
}

function tabSex(m, s) {
  const ws = byId('workshops', m.workshopId);
  const q = s.qty;
  const lines = s.wsLines.map((l) => `<div class="card item row" data-act="edit-wsline" data-id="${m.id}" data-sub="${l.id}">
      <div><b>${h(l.name)}</b><div class="muted">${money(l.price)} × ${fmt(q, 0)} dona${l.note ? ' · ' + h(l.note) : ''}</div></div><b>${money(l.total)}</b></div>`).join('');
  const svcs = s.services.map((x) => `<div class="card item row" data-act="edit-service" data-id="${m.id}" data-sub="${x.id}">
      <div><b>${h(x.name)}</b><div class="muted">${x.mode === 'jami' ? 'Umumiy summa' : `${money(x.price)} × ${fmt(q, 0)} dona`}${x.who ? ' · ' + h(x.who) : ''}</div></div><b>${money(x.total)}</b></div>`).join('');
  const rec = (m.receipts || []).map((r) => `<div class="card item row" data-act="edit-receipt" data-id="${m.id}" data-sub="${r.id}">
      <div><b>${fmt(r.qty, 0)} dona</b><div class="muted">${dateUz(r.date)}${r.note ? ' · ' + h(r.note) : ''}</div></div><span class="muted">›</span></div>`).join('');
  return `
  <section class="card">
    <div class="sec-row"><b>Sex</b><button class="btn sm" data-act="ws-pick" data-id="${m.id}">${ws ? 'O\'zgartirish' : 'Sex tanlash'}</button></div>
    ${ws ? `<div class="ws-box"><a href="#/workshop/${ws.id}"><b>${h(ws.name)}</b></a>${ws.owner ? `<div>👤 ${h(ws.owner)}</div>` : ''}${ws.address ? `<div class="muted">📍 ${h(ws.address)}</div>` : ''}${telLink(ws.phone)} ${telLink(ws.phone2)}</div>` : `<div class="muted">Sex tanlanmagan</div>`}
    <div class="grid2">
      ${kv('Sexga jami', money(s.workshopTotal))}
      ${kv("To'langan", money(s.wsPaid), 'pos')}
      ${kv('Qarz', money(s.wsDebt), s.wsDebt > 0 ? 'neg' : '')}
      ${kv('Sex 1 donaga', money(s.wsItem))}
    </div>
  </section>
  <div class="sec-row"><h2 class="sec">Sex bilan kelishuv · ${money(s.wsItem)}/dona</h2><button class="btn primary sm" data-act="add-wsline" data-id="${m.id}">+ Kelishuv</button></div>
  ${lines || empty("Usluga (to'liq), bichuv, tikuv yoki boshqa — 1 dona uchun narxini yozing.")}
  <div class="sec-row"><h2 class="sec">Qo'shimcha xizmatlar · ${money(s.servicesTotal)}</h2><button class="btn primary sm" data-act="add-service" data-id="${m.id}">+ Xizmat</button></div>
  ${svcs || empty('Dazmol, upakovka, dostavka, print, vishivka, petlya va boshqalar.')}
  <div class="sec-row"><h2 class="sec">Sexdan olingan tayyor tovar · ${fmt(s.received, 0)} dona</h2><button class="btn sm" data-act="add-receipt" data-id="${m.id}">+ Qabul</button></div>
  ${rec || empty("Sexdan tovarni olganingizda sonini yozing — shundan keyin hisob haqiqiy son bo'yicha qilinadi.")}`;
}

function tabSotuv(m, s) {
  const sales = (m.sales || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((x) => {
    const rev = num(x.qty) * num(x.price);
    const pr = rev - num(x.qty) * s.unitCost;
    return `<div class="card item" data-act="edit-sale" data-id="${m.id}" data-sub="${x.id}">
      <div class="item-top"><b>${fmt(x.qty, 0)} dona × ${money(x.price)}</b><span class="grow"></span><b>${money(rev)}</b></div>
      <div class="muted">${dateUz(x.date)}${x.where ? ' · ' + h(x.where) : ''}</div>
      <div class="small ${pr < 0 ? 'neg' : 'pos'}">Foyda: ${money(pr)}</div>
    </div>`;
  }).join('');
  const mk = m.markupType === 'price' ? "O'zim yozgan narx" : m.markupType === 'sum' ? '+' + money(m.markupValue) : '+' + fmt(m.markupValue) + '%';
  return `
  <section class="card grid2">
    ${kv('Tannarx (1 dona)', money(s.unitCost))}
    ${kv('Sotuv narxi', money(s.price))}
    ${kv('Belgilash', mk)}
    ${kv('1 donadan foyda', money(s.unitProfit), s.unitProfit < 0 ? 'neg' : 'pos')}
    ${kv(`Hammasi sotilsa (${fmt(s.qty, 0)})`, money(s.expectedProfit), s.expectedProfit < 0 ? 'neg' : 'pos')}
    ${kv('Omborda', fmt(s.stock, 0) + ' dona')}
  </section>
  <div class="quick"><button class="btn" data-act="markup" data-id="${m.id}">Sotuv narxini belgilash</button><button class="btn primary" data-act="add-sale" data-id="${m.id}">+ Sotuv</button></div>
  <h2 class="sec">Sotuvlar · ${fmt(s.sold, 0)} dona · ${money(s.revenue)} · foyda ${money(s.profitSold)}</h2>
  ${sales || empty("Do'konga topshirgan yoki sotgan tovaringizni shu yerga yozing.")}`;
}

function viewShops() {
  const list = state.shops.map((sh) => {
    const purchases = allMaterials().filter((x) => x.shopId === sh.id);
    const total = sum(purchases, (x) => num(x.qty) * num(x.price));
    return `<div class="card item">
      <a href="#/shop/${sh.id}" class="item-top"><b>${h(sh.name)}</b><span class="grow"></span><span class="muted">${purchases.length} ta xarid</span></a>
      ${sh.market || sh.address ? `<div class="muted">📍 ${h([sh.market, sh.address].filter(Boolean).join(', '))}</div>` : ''}
      <div class="row">${telLink(sh.phone)}<span class="muted">${money(total)}</span></div>
    </div>`;
  }).join('');
  return header("Do'konlar") + `<main>
    <div class="sec-row"><h2 class="sec">Bozordagi do'konlar</h2><button class="btn primary sm" data-act="new-shop">+ Do'kon</button></div>
    ${list || empty("Mato, aksessuar olgan do'konlaringiz manzili va raqamini shu yerda saqlang.")}
  </main>`;
}

function viewShop(id) {
  const sh = byId('shops', id);
  if (!sh) return header('Topilmadi', { back: '#/shops' }) + empty("Do'kon topilmadi");
  const rows = state.models.flatMap((m) => m.materials.filter((x) => x.shopId === id).map((x) => ({ m, x })))
    .sort((a, b) => (b.x.date || '').localeCompare(a.x.date || ''));
  const total = sum(rows, (r) => num(r.x.qty) * num(r.x.price));
  return header(sh.name, { back: '#/shops', right: `<button class="icon-btn" data-act="edit-shop" data-id="${id}">✎</button>` }) + `<main>
    <section class="card">
      ${sh.market ? kv('Bozor', h(sh.market)) : ''}
      ${sh.address ? kv('Manzil', h(sh.address)) : ''}
      <div class="row">${telLink(sh.phone)} ${telLink(sh.phone2)}</div>
      ${sh.note ? `<div class="muted">${h(sh.note)}</div>` : ''}
    </section>
    <h2 class="sec">Shu do'kondan olinganlar · ${money(total)}</h2>
    ${rows.map(({ m, x }) => `<a class="card item" href="#/model/${m.id}">
      <div class="item-top"><b>${h(x.name)}</b>${x.color ? `<span class="chip">${h(x.color)}</span>` : ''}<span class="grow"></span><b>${money(num(x.qty) * num(x.price))}</b></div>
      <div class="muted">${fmt(x.qty)} ${unitShort(x.unit)} × ${money(x.price)} · ${dateUz(x.date)}</div>
      <div class="muted small">Fason: ${h(m.name)}</div></a>`).join('') || empty("Bu do'kondan hali xarid yozilmagan")}
  </main>`;
}

function viewWorkshops() {
  const list = state.workshops.map((ws) => {
    const ms = state.models.filter((m) => m.workshopId === ws.id);
    const debt = sum(ms, (m) => Math.max(0, modelSummary(m).wsDebt));
    return `<div class="card item">
      <a href="#/workshop/${ws.id}" class="item-top"><b>${h(ws.name)}</b><span class="grow"></span><span class="muted">${ms.length} fason</span></a>
      ${ws.owner ? `<div>👤 ${h(ws.owner)}</div>` : ''}
      ${ws.address ? `<div class="muted">📍 ${h(ws.address)}</div>` : ''}
      <div class="row">${telLink(ws.phone)}${debt > 0 ? `<span class="neg">Qarz: ${money(debt)}</span>` : ''}</div>
    </div>`;
  }).join('');
  return header('Sexlar') + `<main>
    <div class="sec-row"><h2 class="sec">Tikuv sexlari</h2><button class="btn primary sm" data-act="new-workshop">+ Sex</button></div>
    ${list || empty('Sexlar manzili, tikuvchi ismi va raqami shu yerda turadi.')}
  </main>`;
}

function viewWorkshop(id) {
  const ws = byId('workshops', id);
  if (!ws) return header('Topilmadi', { back: '#/workshops' }) + empty('Sex topilmadi');
  const ms = state.models.filter((m) => m.workshopId === id);
  let total = 0, paid = 0, items = 0;
  const cards = ms.map((m) => {
    const s = modelSummary(m);
    total += s.workshopTotal; paid += s.wsPaid; items += s.received;
    return `<a class="card item" href="#/model/${m.id}">
      <div class="item-top"><b>${h(m.name)}</b>${statusChip(m.status)}</div>
      <div class="muted">${s.wsLines.map((l) => `${h(l.name)}: ${money(l.price)}`).join(' · ') || 'Kelishuv yozilmagan'}</div>
      <div class="row"><span>Jami: <b>${money(s.workshopTotal)}</b></span><span class="${s.wsDebt > 0 ? 'neg' : 'pos'}">Qarz: ${money(s.wsDebt)}</span></div>
    </a>`;
  }).join('');
  return header(ws.name, { back: '#/workshops', right: `<button class="icon-btn" data-act="edit-workshop" data-id="${id}">✎</button>` }) + `<main>
    <section class="card">
      ${ws.owner ? kv('Tikuvchi / mas\'ul', h(ws.owner)) : ''}
      ${ws.address ? kv('Manzil', h(ws.address)) : ''}
      <div class="row">${telLink(ws.phone)} ${telLink(ws.phone2)}</div>
      ${ws.note ? `<div class="muted">${h(ws.note)}</div>` : ''}
    </section>
    <section class="card grid2">
      ${kv('Olingan tovar', fmt(items, 0) + ' dona')}
      ${kv('Jami ish haqi', money(total))}
      ${kv("To'langan", money(paid), 'pos')}
      ${kv('Qarz', money(total - paid), total - paid > 0 ? 'neg' : '')}
    </section>
    <h2 class="sec">Shu sexdagi fasonlar</h2>
    ${cards || empty("Fason sahifasidagi \"Sex/Xizmat\" bo'limidan shu sexni tanlang")}
  </main>`;
}

function viewMonthly() {
  const ym = ui.month;
  const r = monthReport(state, ym);
  const items = r.overheadItems.map((o) => `<div class="card item row" data-act="edit-overhead" data-sub="${o.id}">
    <div><b>${h(o.name)}</b>${o.note ? `<div class="muted">${h(o.note)}</div>` : ''}</div><b>${money(o.amount)}</b></div>`).join('');
  const rec = state.recurring.map((o) => `<div class="card item row" data-act="edit-recurring" data-sub="${o.id}">
    <b>${h(o.name)}</b><span>${money(o.amount)}</span></div>`).join('');
  return header('Oylik hisob') + `<main>
    <div class="month-nav"><button class="icon-btn" data-act="month" data-d="-1">‹</button><b>${monthName(ym)}</b><button class="icon-btn" data-act="month" data-d="1">›</button></div>
    <section class="card hero">
      <div class="hero-title">Toza foyda</div>
      <div class="hero-big ${r.netProfit < 0 ? 'neg' : ''}">${money(r.netProfit)}</div>
      <div class="hero-sub">Sotuvdan foyda − oylik rasxodlar</div>
    </section>
    <section class="card table plain">
      <div class="tr"><span>Sotuv tushumi (${fmt(r.soldCount, 0)} dona)</span><b>${money(r.revenue)}</b></div>
      <div class="tr"><span>− Sotilgan tovar tannarxi</span><b>${money(r.cogs)}</b></div>
      <div class="tr total"><span>= Sotuvdan foyda</span><b>${money(r.grossProfit)}</b></div>
      <div class="tr"><span>− Oylik rasxodlar</span><b>${money(r.overhead)}</b></div>
      <div class="tr total"><span>= Toza foyda</span><b class="${r.netProfit < 0 ? 'neg' : 'pos'}">${money(r.netProfit)}</b></div>
    </section>
    <section class="card">${kv('Shu oy mato va aksessuarga sarflandi', money(r.purchases))}</section>
    <div class="sec-row"><h2 class="sec">Oylik rasxodlar · ${money(r.overhead)}</h2><button class="btn primary sm" data-act="new-overhead">+ Rasxod</button></div>
    ${items || empty('Ijara, ish haqi, transport, telefon kabi oylik to\'lovlarni shu yerga yozing.')}
    <div class="sec-row"><h2 class="sec">Doimiy rasxodlar (har oy)</h2><button class="btn sm" data-act="new-recurring">+ Doimiy</button></div>
    ${rec || empty("Har oy takrorlanadigan to'lovlarni bir marta kiriting, keyin bir tugma bilan oyga qo'shasiz.")}
    ${state.recurring.length ? `<button class="btn block" data-act="apply-recurring">Doimiy rasxodlarni ${monthName(ym)} ga qo'shish</button>` : ''}
  </main>`;
}

function viewSettings() {
  return header('Sozlamalar', { back: '#/', right: '<span></span>' }) + `<main>
    <section class="card">
      <h3>Zaxira nusxa (backup)</h3>
      <p class="muted">Ma'lumotlar shu telefon/brauzer ichida saqlanadi. Telefon almashtirsangiz yoki boshqa qurilmaga o'tkazmoqchi bo'lsangiz — faylga saqlab oling va yangi qurilmada yuklang. Haftada bir marta saqlab qo'yish tavsiya qilinadi.</p>
      <div class="quick"><button class="btn primary" data-act="export">⬇︎ Faylga saqlash</button>
      <label class="btn">⬆︎ Fayldan yuklash<input type="file" id="import-file" accept="application/json,.json" hidden></label></div>
    </section>
    <section class="card">
      <h3>Telefonga o'rnatish</h3>
      <p><b>iPhone (Safari):</b> pastdagi "Ulashish" ⬆︎ tugmasi → "Bosh ekranga qo'shish" (На экран «Домой»).</p>
      <p><b>Android (Chrome):</b> yuqoridagi ⋮ menyu → "Ilovani o'rnatish" yoki "Bosh ekranga qo'shish".</p>
      <button class="btn" data-act="install" id="install-btn" hidden>📲 O'rnatish</button>
    </section>
    <section class="card">
      <h3>Statistika</h3>
      ${kv('Fasonlar', state.models.length)}${kv("Do'konlar", state.shops.length)}${kv('Sexlar', state.workshops.length)}
    </section>
    <section class="card">
      <h3>Xavfli zona</h3>
      <button class="btn danger" data-act="wipe">Hamma ma'lumotni o'chirish</button>
    </section>
  </main>`;
}

// ---------- Router ----------
const NAV = [['#/', '🏠', 'Asosiy'], ['#/models', '👗', 'Fasonlar'], ['#/shops', '🏪', "Do'konlar"], ['#/workshops', '🧵', 'Sexlar'], ['#/monthly', '📅', 'Oylik']];

function render() {
  const hash = location.hash || '#/';
  const [, route, id] = hash.split('/');
  let html;
  switch (route) {
    case 'models': html = viewModels(); break;
    case 'model': html = viewModel(id); break;
    case 'shops': html = viewShops(); break;
    case 'shop': html = viewShop(id); break;
    case 'workshops': html = viewWorkshops(); break;
    case 'workshop': html = viewWorkshop(id); break;
    case 'monthly': html = viewMonthly(); break;
    case 'settings': html = viewSettings(); break;
    default: html = viewDashboard();
  }
  const scroll = window.scrollY;
  const sameRoute = render.last === hash;
  $('#app').innerHTML = html;
  render.last = hash;
  const section = { model: '#/models', shop: '#/shops', workshop: '#/workshops' }[route] || '#/' + (route || '');
  $('#nav').innerHTML = NAV.map(([href, icon, label]) => `<a href="${href}" class="${href === section || (href === '#/' && !route) ? 'on' : ''}"><span>${icon}</span>${label}</a>`).join('');
  if (route === 'models') renderList();
  window.scrollTo(0, sameRoute ? scroll : 0);
  if (route === 'settings' && deferredInstall) $('#install-btn').hidden = false;
}

window.addEventListener('hashchange', render);

// ---------- Harakatlar ----------
const findSub = (list, sub) => list.find((x) => x.id === sub);

const actions = {
  'close-form': closeForm,
  'form-delete': async () => {
    const res = currentForm.onDelete();
    if (res === false) return;
    closeForm();
    await commit();
    toast("O'chirildi");
  },
  'add-part': () => { $('.parts').insertAdjacentHTML('beforeend', partRow({ name: '', per: '' })); $('.parts .part-row:last-child input').focus(); },
  'del-part': (d, el) => { el.closest('.part-row').remove(); updateLive(); },
  'new-model': () => modelForm(null),
  'edit-model': (d) => modelForm(model(d.id)),
  'edit-colorway': (d) => { const m = model(d.id); colorwayForm(m, findSub(m.colorways, d.sub)); },
  tab: (d) => { ui.tab[d.id] = d.tab; render(); },
  'add-material': (d) => materialForm(model(d.id), null, d.kind),
  'edit-material': (d) => { const m = model(d.id); materialForm(m, findSub(m.materials, d.sub)); },
  'ws-pick': (d) => workshopPickForm(model(d.id)),
  'add-wsline': (d) => wsLineForm(model(d.id)),
  'edit-wsline': (d) => { const m = model(d.id); wsLineForm(m, findSub(m.wsLines, d.sub)); },
  'add-service': (d) => serviceForm(model(d.id)),
  'edit-service': (d) => { const m = model(d.id); serviceForm(m, findSub(m.services, d.sub)); },
  'add-receipt': (d) => receiptForm(model(d.id)),
  'edit-receipt': (d) => { const m = model(d.id); receiptForm(m, findSub(m.receipts, d.sub)); },
  markup: (d) => markupForm(model(d.id)),
  'add-sale': (d) => {
    const m = model(d.id);
    if (receivedQty(m) - soldQty(m) <= 0 && !confirm("Omborda tovar yo'q (sexdan olinmagan). Baribir sotuv yozasizmi?")) return;
    saleForm(m);
  },
  'edit-sale': (d) => { const m = model(d.id); saleForm(m, findSub(m.sales, d.sub)); },
  'new-shop': () => shopForm(null),
  'edit-shop': (d) => shopForm(byId('shops', d.id)),
  'new-workshop': () => workshopForm(null),
  'edit-workshop': (d) => workshopForm(byId('workshops', d.id)),
  'new-overhead': () => overheadForm(null),
  'edit-overhead': (d) => overheadForm(findSub(state.overhead, d.sub)),
  'new-recurring': () => recurringForm(null),
  'edit-recurring': (d) => recurringForm(findSub(state.recurring, d.sub)),
  'apply-recurring': async () => {
    const ym = ui.month;
    let added = 0;
    for (const r of state.recurring) {
      if (state.overhead.some((o) => o.month === ym && o.name === r.name)) continue;
      state.overhead.push({ id: uid(), name: r.name, amount: r.amount, month: ym });
      added++;
    }
    await commit();
    toast(added ? `${added} ta rasxod qo'shildi` : "Hammasi allaqachon qo'shilgan");
  },
  month: (d) => { ui.month = shiftMonth(ui.month, +d.d); render(); },
  export: exportBackup,
  install: async () => { if (!deferredInstall) return; deferredInstall.prompt(); deferredInstall = null; },
  wipe: async () => {
    if (!confirm("Hamma ma'lumot o'chadi! Avval zaxira nusxa olganingizga ishonchingiz komilmi?")) return;
    if (prompt('Tasdiqlash uchun "OCHIR" deb yozing') !== 'OCHIR') return;
    state = normalize(null);
    await commit();
    location.hash = '#/';
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (e.target.closest('a.tel')) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && currentForm) closeForm(); });

// ---------- Backup ----------
async function exportBackup() {
  const name = `fason-hisob-${today()}.json`;
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.models)) throw new Error('format');
    if (!confirm(`Fayldagi ma'lumot (${data.models.length} fason) hozirgisining o'rniga yoziladi. Davom etasizmi?`)) return;
    state = normalize(data);
    await commit();
    toast('Yuklandi ✓');
  } catch {
    alert("Fayl noto'g'ri. Faqat shu ilovadan saqlangan .json fayl yuklanadi.");
  }
}

// ---------- O'rnatish / offline ----------
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

(async () => {
  state = await loadState();
  navigator.storage?.persist?.().catch(() => {});
  render();
})();
