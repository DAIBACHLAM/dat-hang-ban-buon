/**
 * Code.gs — Backend Google Apps Script cho Web Đặt Hàng Bán Buôn.
 * Gắn vào Google Sheet (Extensions > Apps Script). Deploy: Web app, Execute as ME, Access: Anyone.
 *
 * Script Properties (Project Settings > Script properties):
 *   ADMIN_PIN          mã PIN trang admin (bắt buộc)
 *   NHANH_BUSINESS_ID  200642
 *   NHANH_APP_ID       appId Nhanh.vn
 *   NHANH_SECRET_KEY   secretKey (dự phòng)
 *   NHANH_ACCESS_TOKEN accessToken Nhanh.vn
 *
 * QUY TẮC: không bao giờ trả số tồn thực tế ra API công khai (catalog/order).
 */

const SH = {
  PROD: 'San_Pham', STOCK: 'Ton_Buon', DISC: 'Chiet_Khau', ORD: 'Don_Buon'
};
const HEAD = {
  San_Pham: ['key', 'ma', 'ten', 'brand', 'category', 'line', 'gia', 'anh', 'url', 'updated'],
  Ton_Buon: ['key', 'size', 'ton', 'updated'],
  Chiet_Khau: ['level', 'name', 'pct'],
  Don_Buon: ['id', 'time', 'name', 'phone', 'note', 'status', 'total', 'items']
};

/* ---------- Entry points ---------- */
function doGet(e) {
  try {
    const a = (e.parameter && e.parameter.action) || 'catalog';
    if (a === 'catalog') return json_(buildCatalog_());
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.action === 'order') return json_(submitOrder_(req));
    // Từ đây trở xuống: chỉ admin
    if (!checkPin_(req.pin)) return json_({ ok: false, error: 'PIN sai' });
    switch (req.action) {
      case 'auth': return json_({ ok: true });
      case 'adminData': return json_(adminData_());
      case 'uploadStock': return json_(uploadStock_(req.rows));
      case 'saveDiscounts': return json_(saveDiscounts_(req.rows));
      case 'syncWeb': return json_(syncWeb_(req.page || 1));
      case 'orders': return json_(listOrders_());
      case 'orderStatus': return json_(setOrderStatus_(req.id, req.status));
    }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
}

/* ---------- Helpers ---------- */
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function checkPin_(pin) {
  const p = prop_('ADMIN_PIN');
  return p && String(pin) === p;
}
function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1, HEAD[name].length).setValues([HEAD[name]]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}
function read_(name) {
  const s = sheet_(name), n = s.getLastRow();
  if (n < 2) return [];
  const h = HEAD[name];
  return s.getRange(2, 1, n - 1, h.length).getValues().map(r => {
    const o = {}; h.forEach((k, i) => o[k] = r[i]); return o;
  });
}
function writeAll_(name, rows) {
  const s = sheet_(name), h = HEAD[name];
  const last = s.getLastRow();
  if (last > 1) s.getRange(2, 1, last - 1, h.length).clearContent();
  if (!rows.length) return;
  s.getRange(2, 1, rows.length, h.length).setNumberFormat('@'); // giữ text: size "1/2", mã...
  s.getRange(2, 1, rows.length, h.length).setValues(rows);
}
/** Chuẩn hóa mã NB — PHẢI giống canon() trong admin.html */
function canon_(code) {
  let s = String(code || '').toUpperCase().replace(/\s+/g, '');
  s = s.replace(/^P-/, '');
  s = s.replace(/([0-9])[VC]$/, '$1');
  return s;
}
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', '4XL', 'FREESIZE'];
function sizeCmp_(a, b) {
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  if (!isNaN(na)) return -1;
  if (!isNaN(nb)) return 1;
  const ia = SIZE_ORDER.indexOf(a), ib = SIZE_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
}

/* ---------- Chiết khấu ---------- */
function loadDisc_() {
  const d = { line: {}, category: {}, brand: {}, def: 0 };
  read_(SH.DISC).forEach(r => {
    const v = Number(r.pct);
    if (isNaN(v)) return;
    if (r.level === 'default') d.def = v;
    else if (d[r.level]) d[r.level][r.name] = v;
  });
  return d;
}
function discountOf_(p, d) {
  if (d.line[p.line] !== undefined) return d.line[p.line];
  if (d.category[p.category] !== undefined) return d.category[p.category];
  if (d.brand[p.brand] !== undefined) return d.brand[p.brand];
  return d.def;
}
function unitPrice_(gia, pct) { return Math.round(Number(gia) * (100 - pct) / 100); }

/* ---------- Catalog công khai (KHÔNG có số tồn) ---------- */
function buildCatalog_() {
  const disc = loadDisc_();
  const sizes = {};
  read_(SH.STOCK).forEach(r => {
    if (Number(r.ton) > 0) (sizes[r.key] = sizes[r.key] || []).push(String(r.size));
  });
  const products = [];
  read_(SH.PROD).forEach(p => {
    const s = sizes[p.key];
    if (!s || !Number(p.gia)) return; // không tồn hoặc chưa có giá -> ẩn
    products.push({
      k: p.key, m: p.ma, n: p.ten, b: p.brand, c: p.category, l: p.line,
      g: Number(p.gia), i: p.anh, s: s.sort(sizeCmp_), d: discountOf_(p, disc)
    });
  });
  return { ok: true, ts: Date.now(), products: products };
}

/* ---------- Đặt đơn ---------- */
function submitOrder_(req) {
  const name = String(req.name || '').trim(), phone = String(req.phone || '').trim();
  if (!name || !/^[0-9+\s.]{8,15}$/.test(phone)) return { ok: false, error: 'Vui lòng nhập tên và số điện thoại hợp lệ' };
  if (!req.items || !req.items.length || req.items.length > 500) return { ok: false, error: 'Giỏ hàng trống' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const prods = {}; read_(SH.PROD).forEach(p => prods[p.key] = p);
    const stock = {}; read_(SH.STOCK).forEach(r => stock[r.key + '|' + r.size] = Number(r.ton));
    const disc = loadDisc_();
    const lines = []; let total = 0;
    for (const it of req.items) {
      const p = prods[it.k], qty = Math.floor(Number(it.qty));
      if (!p || !(qty > 0)) return { ok: false, error: 'Sản phẩm không hợp lệ' };
      if ((stock[it.k + '|' + it.size] || 0) < qty)
        return { ok: false, error: 'Mã ' + p.ma + ' size ' + it.size + ' không đủ hàng, vui lòng giảm số lượng hoặc bỏ size này' };
      const pct = discountOf_(p, disc), unit = unitPrice_(p.gia, pct);
      lines.push({ k: it.k, ma: p.ma, ten: p.ten, brand: p.brand, category: p.category, line: p.line,
        size: String(it.size), qty: qty, gia: Number(p.gia), pct: pct, unit: unit, amount: unit * qty });
      total += unit * qty;
    }
    const s = sheet_(SH.ORD);
    const now = new Date();
    const id = 'DB' + Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'yyMMdd') + '-' + String(s.getLastRow()).padStart(3, '0');
    const time = Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
    s.appendRow([id, time, name, "'" + phone, String(req.note || ''), 'Mới', total, JSON.stringify(lines)]);
    return { ok: true, id: id, time: time, name: name, phone: phone, note: String(req.note || ''), lines: lines, total: total };
  } finally { lock.releaseLock(); }
}

/* ---------- Admin ---------- */
function adminData_() {
  const prods = read_(SH.PROD), stock = read_(SH.STOCK);
  const have = {}; prods.forEach(p => have[p.key] = 1);
  const stockKeys = {}; let pieces = 0;
  stock.forEach(r => { stockKeys[r.key] = 1; pieces += Number(r.ton) || 0; });
  const unmatched = Object.keys(stockKeys).filter(k => !have[k]);
  const uniq = f => Array.from(new Set(prods.map(p => p[f]).filter(Boolean))).sort();
  return {
    ok: true,
    discounts: read_(SH.DISC),
    brands: uniq('brand'), categories: uniq('category'), lines: uniq('line'),
    stats: { products: prods.length, stockCodes: Object.keys(stockKeys).length, pieces: pieces, unmatched: unmatched.slice(0, 300), unmatchedCount: unmatched.length }
  };
}

/** rows: [[key,size,qty],...] — thay thế toàn bộ Ton_Buon */
function uploadStock_(rows) {
  if (!rows || !rows.length) return { ok: false, error: 'Không có dữ liệu' };
  const t = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm');
  writeAll_(SH.STOCK, rows.map(r => [canon_(r[0]), String(r[1]), Math.max(0, Number(r[2]) || 0), t]));
  return { ok: true, saved: rows.length };
}

function saveDiscounts_(rows) {
  writeAll_(SH.DISC, (rows || []).filter(r => r.pct !== '' && r.pct !== null && !isNaN(Number(r.pct)))
    .map(r => [r.level, r.name, Math.min(100, Math.max(0, Number(r.pct)))]));
  return { ok: true };
}

function listOrders_() {
  const stock = {}; read_(SH.STOCK).forEach(r => stock[r.key + '|' + r.size] = Number(r.ton));
  const orders = read_(SH.ORD).reverse().slice(0, 300).map(o => {
    let lines = []; try { lines = JSON.parse(o.items); } catch (e) {}
    lines.forEach(l => { l.ton = stock[l.k + '|' + l.size] || 0; }); // chỉ admin thấy tồn
    return { id: o.id, time: o.time, name: o.name, phone: String(o.phone).replace(/^'/, ''), note: o.note, status: o.status, total: o.total, lines: lines };
  });
  return { ok: true, orders: orders };
}
function setOrderStatus_(id, status) {
  const s = sheet_(SH.ORD), n = s.getLastRow();
  if (n < 2) return { ok: false };
  const ids = s.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === id) { s.getRange(i + 2, 6).setValue(status); return { ok: true }; }
  return { ok: false, error: 'Không thấy đơn' };
}

/* ---------- Đồng bộ từ Nhanh.vn (mixsport.vn + liningvietnam.com.vn dùng chung Business 200642) ---------- */
function nhanh_(path, data) {
  const res = UrlFetchApp.fetch('https://open.nhanh.vn' + path, {
    method: 'post', muteHttpExceptions: true,
    payload: {
      version: '2.0', appId: prop_('NHANH_APP_ID'), businessId: prop_('NHANH_BUSINESS_ID') || '200642',
      accessToken: prop_('NHANH_ACCESS_TOKEN'), data: JSON.stringify(data || {})
    }
  });
  const j = JSON.parse(res.getContentText());
  if (j.code !== 1) throw new Error('Nhanh.vn: ' + JSON.stringify(j.messages || j.errorCode || j));
  return j.data;
}
function toArr_(x) { return Array.isArray(x) ? x : (x ? Object.keys(x).map(k => x[k]) : []); }

function loadCategories_() {
  const map = {};
  try {
    const flat = (list, parent) => toArr_(list).forEach(c => {
      map[c.id] = { name: c.name, parent: c.parentId || parent || 0 };
      if (c.childs || c.children) flat(c.childs || c.children, c.id);
    });
    flat(nhanh_('/api/product/category', {}));
  } catch (e) { /* bỏ qua, sẽ phân loại theo tên */ }
  return map;
}
/** Danh mục = nhóm cha cấp cao nhất; Dòng hàng = nhóm con (hoặc suy từ tên) */
function classify_(p, cats) {
  let c = cats[p.categoryId], category = '', line = '';
  if (c) {
    const chain = [c]; while (chain[0].parent && cats[chain[0].parent]) chain.unshift(cats[chain[0].parent]);
    category = chain[0].name; line = chain.length > 1 ? chain[chain.length - 1].name : '';
  }
  const n = String(p.name || '').toLowerCase();
  if (!category) category = /giày|dép|sandal/.test(n) ? 'Giày dép' : /balo|túi|vợt|bóng|tất|vớ|mũ|nón|băng|phụ kiện/.test(n) ? 'Phụ kiện' : 'Quần áo';
  if (!line) {
    const rules = [[/chạy bộ|running/, 'Giày chạy bộ'], [/cầu lông/, 'Giày cầu lông'], [/pickleball|tennis/, 'Giày Pickleball/Tennis'],
      [/polo/, 'Áo Polo'], [/t-?shirt|áo thun|áo phông/, 'Áo T-shirt'], [/short|quần ngắn/, 'Quần Short'], [/balo|túi/, 'Balo/Túi'], [/giày/, 'Giày thời trang']];
    for (const r of rules) if (r[0].test(n)) { line = r[1]; break; }
  }
  return { category: category, line: line || 'Khác' };
}

/** Mỗi lần gọi xử lý tối đa 5 trang (500 SP). Admin gọi lặp tới khi next=null. */
function syncWeb_(page) {
  if (!prop_('NHANH_ACCESS_TOKEN')) return { ok: false, error: 'Chưa cấu hình NHANH_ACCESS_TOKEN trong Script Properties' };
  const cats = loadCategories_();
  const have = {}; read_(SH.PROD).forEach(p => have[p.key] = p);
  const t = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm');
  let p = page, totalPages = page, count = 0;
  for (let i = 0; i < 5 && p <= totalPages; i++, p++) {
    const d = nhanh_('/api/product/search', { page: p, icpp: 100 });
    totalPages = Number(d.totalPages) || p;
    toArr_(d.products).forEach(x => {
      const key = canon_(x.code); if (!key) return;
      const cl = classify_(x, cats), old = have[key] || {};
      have[key] = {
        key: key, ma: x.code, ten: x.name, brand: x.brandName || x.brand || old.brand || '',
        category: cl.category, line: cl.line, gia: Number(x.price) || Number(old.gia) || 0,
        anh: x.image || old.anh || '', url: x.link || old.url || '', updated: t
      };
      count++;
    });
  }
  writeAll_(SH.PROD, Object.keys(have).map(k => HEAD.San_Pham.map(h => have[k][h] === undefined ? '' : have[k][h])));
  return { ok: true, synced: count, next: p <= totalPages ? p : null, totalPages: totalPages };
}
