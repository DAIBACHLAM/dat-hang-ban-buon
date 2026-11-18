/**
 * Code.gs — Backend Google Apps Script cho Web Đặt Hàng Bán Buôn.
 * Gắn vào Google Sheet (Extensions > Apps Script). Deploy: Web app, Execute as ME, Access: Anyone.
 *
 * Script Properties (Project Settings > Script properties):
 *   ADMIN_PIN          mã PIN trang admin (bắt buộc)
 * (Đồng bộ sản phẩm lấy từ products.json công khai của 2 web Haravan — không cần token Nhanh.vn.)
 *
 * QUY TẮC: không bao giờ trả số tồn thực tế ra API công khai (catalog/order).
 */

const SH = {
  PROD: 'San_Pham', STOCK: 'Ton_Buon', DISC: 'Chiet_Khau', ORD: 'Don_Buon'
};
const HEAD = {
  San_Pham: ['key', 'ma', 'ten', 'brand', 'category', 'line', 'gia', 'anh', 'url', 'updated', 'variants', 'site'],
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
      case 'syncWeb': return json_(syncWeb_(req.next || null));
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

/* ---------- Tồn theo sản phẩm Haravan ---------- */
/** Chuẩn hóa size — PHẢI giống normSize() trong admin.html */
function normSize_(v) {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/\s+/g, '');
  if (!s || s === 'NO' || s === 'FREE' || s === 'FREESIZE' || s === 'F' || s === 'DEFAULTTITLE') return 'FREESIZE';
  s = s.replace(/^A\//, '');
  if (s === 'XXL') s = '2XL';
  return s;
}
function loadStock_() {
  const m = {};
  read_(SH.STOCK).forEach(r => { m[r.key + '|' + normSize_(r.size)] = Number(r.ton) || 0; });
  return m;
}
function variantsOf_(p) {
  try { const v = JSON.parse(p.variants); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
/** {size: tồn} cho 1 sản phẩm — khớp mã (barcode/sku chuẩn hóa) × size (theo option Haravan, rồi theo đuôi SKU); mỗi (mã,size) chỉ tính 1 lần. CHỈ dùng nội bộ server/admin. */
function stockSizes_(p, stock) {
  const out = {}, seen = {};
  variantsOf_(p).forEach(v => {
    for (const key of [v.k, v.b]) {
      if (!key) continue;
      for (const z of [v.z, v.u]) {
        if (!z) continue;
        const id = key + '|' + z;
        if (stock[id] === undefined) continue;
        if (!seen[id]) { seen[id] = 1; out[v.z] = (out[v.z] || 0) + stock[id]; }
        return;
      }
    }
  });
  return out;
}

/* ---------- Catalog công khai (KHÔNG có số tồn) ---------- */
function buildCatalog_() {
  const disc = loadDisc_(), stock = loadStock_();
  const products = [];
  read_(SH.PROD).forEach(p => {
    if (!Number(p.gia) || !p.anh) return;
    const ss = stockSizes_(p, stock);
    const sizes = Object.keys(ss).filter(z => ss[z] > 0).sort(sizeCmp_);
    if (!sizes.length) return; // không size nào còn tồn -> ẩn
    products.push({
      k: p.key, m: p.ma, n: p.ten, b: p.brand, c: p.category, l: p.line,
      g: Number(p.gia), i: p.anh, s: sizes, d: discountOf_(p, disc)
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
    const stock = loadStock_();
    const disc = loadDisc_();
    const lines = []; let total = 0;
    for (const it of req.items) {
      const p = prods[it.k], qty = Math.floor(Number(it.qty));
      if (!p || !(qty > 0)) return { ok: false, error: 'Sản phẩm không hợp lệ' };
      if ((stockSizes_(p, stock)[normSize_(it.size)] || 0) < qty)
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
  const matched = {};
  prods.forEach(p => variantsOf_(p).forEach(v => { if (v.k) matched[v.k] = 1; if (v.b) matched[v.b] = 1; }));
  const unmatched = Object.keys(stockKeys).filter(k => !matched[k]); // mã có tồn nhưng không thuộc sản phẩm nào trên 2 web
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
  const stock = loadStock_(), prods = {}; read_(SH.PROD).forEach(p => prods[p.key] = p);
  const orders = read_(SH.ORD).reverse().slice(0, 300).map(o => {
    let lines = []; try { lines = JSON.parse(o.items); } catch (e) {}
    lines.forEach(l => { l.ton = prods[l.k] ? (stockSizes_(prods[l.k], stock)[normSize_(l.size)] || 0) : 0; }); // chỉ admin thấy tồn
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

/* ---------- Đồng bộ từ 2 web Haravan (collections/all/products.json công khai) ---------- */
const SITES = [
  { name: 'mixsport.vn', base: 'https://mixsport.vn', brand: '' },
  { name: 'liningvietnam.com.vn', base: 'https://liningvietnam.com.vn', brand: 'Li-Ning' }
];
const HARAVAN_LIMIT = 250;
// Thử lần lượt từng endpoint ở trang 1, dùng endpoint đầu tiên trả được sản phẩm. (Kiểm tra 18/11/2026: /products.json trả 404 trên cả 2 web; /collections/all/products.json chạy nhưng chỉ trả tối đa 50 SP/trang dù limit=250.)
const HARAVAN_PATHS = ['/products.json', '/collections/all/products.json'];

function parseJsonOrExplain_(text, where) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch (e) {
    const title = (t.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const plain = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(where + ' trả về ' + (/^</.test(t) ? 'HTML' : 'dữ liệu') + ' thay vì JSON' +
      (title.trim() ? ' — tiêu đề: "' + title.trim() + '"' : '') + ' — nội dung: ' + (plain || t).slice(0, 300));
  }
}
function fold_(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase(); }

/** Không bao giờ ném lỗi: trả {ok, products, error}. Thử lại 1 lần khi lỗi mạng / HTTP != 200 / không phải JSON. */
function fetchHaravan_(site, pathIdx, page) {
  const url = site.base + HARAVAN_PATHS[pathIdx] + '?limit=' + HARAVAN_LIMIT + '&page=' + page;
  let error = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) Utilities.sleep(1500);
    try {
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
      const code = res.getResponseCode();
      if (code !== 200) { error = 'HTTP ' + code; continue; }
      const j = JSON.parse(res.getContentText());
      return { ok: true, products: Array.isArray(j.products) ? j.products : [], error: '' };
    } catch (e) { error = String(e).slice(0, 160); }
  }
  return { ok: false, products: [], error: site.name + ' ' + HARAVAN_PATHS[pathIdx] + ' trang ' + page + ': ' + error };
}

/** Bỏ hậu tố size khỏi SKU: chỉ bỏ khi hậu tố đúng bằng size của chính variant đó (không đụng mã màu như -4). */
function baseSku_(sku, rawSize) {
  const s = String(sku || '').trim().toUpperCase();
  if (!s) return '';
  const r = String(rawSize || '').trim().toUpperCase(), cands = {};
  [r, r.replace(/^A\//, ''), normSize_(r)].forEach(c => { if (c && c !== 'FREESIZE' && c !== 'DEFAULTTITLE') cands[c] = 1; });
  for (const c in cands) {
    const re = new RegExp('[-_\\s]+(A\\/)?' + c.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '$');
    if (re.test(s)) return s.replace(re, '');
  }
  return s;
}

// [regex trên chữ không dấu, Dòng hàng, Danh mục]
const LINE_RULES = [
  [/giay.*(chay|running)|running/, 'Giày chạy bộ', 'Giày dép'],
  [/giay.*cau long/, 'Giày cầu lông', 'Giày dép'],
  [/giay.*(pickleball|tennis)/, 'Giày Pickleball/Tennis', 'Giày dép'],
  [/giay.*bong ro/, 'Giày bóng rổ', 'Giày dép'],
  [/giay.*(bong da|futsal)/, 'Giày bóng đá', 'Giày dép'],
  [/giay|\bdep\b|sandal/, 'Giày thời trang', 'Giày dép'],
  [/polo/, 'Áo Polo', 'Quần áo'],
  [/t-?shirt|ao thun|ao phong/, 'Áo T-shirt', 'Quần áo'],
  [/ao khoac|jacket|hoodie|ao ni\b|ao gio/, 'Áo khoác', 'Quần áo'],
  [/\bvay\b|\bdam\b/, 'Váy/Đầm', 'Quần áo'],
  [/short|quan ngan/, 'Quần Short', 'Quần áo'],
  [/\bquan\b(?! ao)/, 'Quần dài', 'Quần áo'],
  [/\bao\b/, 'Áo khác', 'Quần áo'],
  [/balo|\btui\b|backpack/, 'Balo/Túi', 'Phụ kiện'],
  [/\bvot\b|qua cau|\bluoi\b|\bbong\b/, 'Dụng cụ thể thao', 'Dụng cụ thể thao'],
  [/\btat\b|\bvo\b|\bmu\b|\bnon\b|\bbang\b|phu kien/, 'Phụ kiện khác', 'Phụ kiện'],
  [/quan ao|thoi trang/, 'Quần áo khác', 'Quần áo']
];
/** Danh mục / Dòng hàng: ưu tiên tên sản phẩm, rồi product_type + tags của Haravan */
function classifyHaravan_(hp) {
  const tags = Array.isArray(hp.tags) ? hp.tags.join(' ') : String(hp.tags || '');
  for (const txt of [fold_(hp.title), fold_(hp.product_type + ' ' + tags)]) {
    for (const r of LINE_RULES) if (r[0].test(txt)) return { line: r[1], category: r[2] };
  }
  return { line: String(hp.product_type || '').trim() || 'Khác', category: 'Khác' };
}

/**
 * 1 product Haravan -> các dòng San_Pham, mỗi dòng = 1 Mã NB (barcode) gom TẤT CẢ size vào `variants` (1 card).
 * Web Li-Ning "GỘP MÀU": 1 product có nhiều màu = nhiều Mã NB -> mỗi màu 1 card (tên thêm tên màu) để size/tồn không lẫn màu.
 * Bỏ: ẩn (published_at null), không ảnh, không SKU/barcode.
 * Mã gốc ưu tiên `barcode` (sạch, vd P-AKPW001-12V); không có thì lấy SKU và bỏ hậu tố size của chính variant.
 */
function mapHaravan_(hp, site, t) {
  if (!hp.published_at) return [];
  const imgs = hp.images || [];
  if (!imgs.length && !(hp.image && hp.image.src)) return [];
  const optIdx = re => (hp.options || []).findIndex(o => re.test(fold_(o.name)));
  const si = optIdx(/size|kich/), ci = optIdx(/mau|color/); // si < 0: sản phẩm chỉ có option Màu -> size lấy từ đuôi SKU
  const groups = {};
  (hp.variants || []).forEach(v => {
    const raw = si >= 0 ? (v['option' + (si + 1)] || '') : '';
    const bar = String(v.barcode || '').trim().toUpperCase(), sku = String(v.sku || '').trim().toUpperCase();
    const skuBase = baseSku_(sku, raw);
    const rawKey = bar || skuBase;
    const k = canon_(rawKey);
    if (!k) return;
    let u = '';  // đuôi size trong SKU (vd UK 4.5) — dự phòng khi file tồn dùng size khác option Haravan
    if (bar && sku.indexOf(bar) === 0) u = normSize_(sku.slice(bar.length).replace(/^[-_\s]+/, ''));
    const b = canon_(skuBase) !== k ? canon_(skuBase) : '';
    u = u === 'FREESIZE' ? '' : u;
    let z = si >= 0 ? normSize_(raw) : (u || 'FREESIZE');
    if (String(raw).trim().toUpperCase() === 'CHUNG') z = 'FREESIZE'; // "Chung" = freesize
    const g = groups[k] = groups[k] || { raw: rawKey, vs: [], color: '', img: '', price: 0 };
    if (!g.vs.some(x => x.z === z)) g.vs.push({ k: k, b: b, z: z, u: u });
    if (ci >= 0 && !g.color) g.color = String(v['option' + (ci + 1)] || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!g.img && v.image_id) { const im = imgs.find(i => i.id === v.image_id); if (im) g.img = im.src; }
    g.price = Math.max(g.price, Number(v.price) || 0, Number(v.compare_at_price) || 0);
  });
  const keys = Object.keys(groups), cl = classifyHaravan_(hp);
  const firstImg = (imgs[0] && imgs[0].src) || (hp.image && hp.image.src) || '';
  return keys.map(k => {
    const g = groups[k];
    return {
      key: k, ma: g.raw, ten: keys.length > 1 && g.color ? hp.title + ' - ' + g.color : hp.title,
      brand: String(hp.vendor || '').trim() || site.brand, category: cl.category, line: cl.line, gia: g.price,
      anh: g.img || firstImg, url: site.base + '/products/' + hp.handle, updated: t, site: site.name, variants: g.vs
    };
  });
}

function resetSheet_(name) {
  const s = sheet_(name);
  s.clear();
  s.getRange(1, 1, 1, HEAD[name].length).setValues([HEAD[name]]).setFontWeight('bold');
  s.setFrozenRows(1);
}

/**
 * Lượt đầu (cursor = null): XÓA SẠCH San_Pham rồi quét 2 web Haravan. Mỗi lượt ≤ ~150 giây / 40 trang.
 * KHÔNG ném lỗi khi 1 trang hỏng: dừng web đó, giữ nguyên mọi sản phẩm đã lấy, ghi vào Sheets và trả `warnings`.
 * Trang rỗng = hết sản phẩm của web đó. Con trỏ next = {s: web, p: trang, e: endpoint} tới khi null.
 */
function syncWeb_(cursor) {
  const t0 = Date.now();
  let s = 0, p = 1, e = -1;
  if (!cursor) resetSheet_(SH.PROD); else { s = Number(cursor.s) || 0; p = Number(cursor.p) || 1; e = cursor.e === undefined ? -1 : Number(cursor.e); }
  const have = {}, warnings = [];
  read_(SH.PROD).forEach(r => { r.variants = variantsOf_(r); have[r.key] = r; });
  const t = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm');
  let count = 0, skipped = 0, pages = 0;
  try {
    while (s < SITES.length && pages < 40 && Date.now() - t0 < 150000) {
      const site = SITES[s];
      let list = [], fail = '';
      if (p === 1 || e < 0) { // chọn endpoint chạy được cho web này
        e = -1;
        for (let i = 0; i < HARAVAN_PATHS.length && e < 0; i++) {
          const r = fetchHaravan_(site, i, 1); pages++;
          if (r.ok && r.products.length) { e = i; list = r.products; } else fail = r.error || (site.name + ' ' + HARAVAN_PATHS[i] + ': không có sản phẩm');
          Utilities.sleep(300);
        }
        if (e < 0) { warnings.push(fail); s++; p = 1; e = -1; continue; }
      } else {
        const r = fetchHaravan_(site, e, p); pages++;
        if (!r.ok) { warnings.push(r.error + ' — dừng web này, đã giữ các trang trước'); s++; p = 1; e = -1; continue; }
        list = r.products;
        Utilities.sleep(300);
      }
      list.forEach(hp => {
        const rows = mapHaravan_(hp, site, t);
        if (!rows.length) { skipped++; return; }
        rows.forEach(r => {
          const old = have[r.key];
          if (old) { // đã có từ web trước: giữ thông tin cũ, chỉ hợp nhất variants
            const seen = {}; old.variants.forEach(v => seen[v.k + '|' + v.z] = 1);
            r.variants.forEach(v => { if (!seen[v.k + '|' + v.z]) old.variants.push(v); });
          } else have[r.key] = r;
          count++;
        });
      });
      if (!list.length || p >= 400) { s++; p = 1; e = -1; } else p++; // trang rỗng = hết web
    }
  } catch (err) { // lưới an toàn cuối: không bao giờ mất dữ liệu đã lấy
    warnings.push('Lỗi bất ngờ: ' + String(err).slice(0, 200)); s = SITES.length;
  }
  writeAll_(SH.PROD, Object.keys(have).map(k => HEAD.San_Pham.map(h => h === 'variants' ? JSON.stringify(have[k].variants) : (have[k][h] === undefined ? '' : have[k][h]))));
  return { ok: true, synced: count, skipped: skipped, pages: pages, warnings: warnings, total: Object.keys(have).length,
    site: s < SITES.length ? SITES[s].name : '', next: s < SITES.length ? { s: s, p: p, e: e } : null };
}
