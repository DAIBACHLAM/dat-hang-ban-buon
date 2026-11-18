# ARCHITECTURE.md

## Luồng dữ liệu
```
 mixsport.vn ──────┐  Haravan  /collections/all/products.json (công khai, 50 SP/trang)
 liningvietnam.com.vn┘          │ syncWeb (xóa sạch San_Pham rồi nạp lại)
                                ▼
 admin.html ──POST(PIN)──► Code.gs ─┬─> Sheet San_Pham   (key,ma,ten,brand,category,line,gia,anh,url,variants JSON,site)
 (GitHub Pages)               ▲     ├─> Sheet Ton_Buon   (key,size,tồn) ← file tồn parse tại trình duyệt (SheetJS)
                              │     ├─> Sheet Chiet_Khau (level,name,pct)
 index.html ──GET catalog─────┘     └─> Sheet Don_Buon   (đơn)
            ──POST order──────►  (server tính lại giá, kiểm tồn qua variants)
```
- Catalog = San_Pham (Haravan) ⋈ Ton_Buon: chỉ sản phẩm có ≥1 size tồn > 0.
- `GET ?action=catalog` công khai, chỉ trả size còn hàng + % chiết khấu; client cache `localStorage` (hiện ngay, làm mới nền).
- Mọi action admin là `POST` kèm `pin`, so với Script Property `ADMIN_PIN`.

## Sheets
`San_Pham(key,ma,ten,brand,category,line,gia,anh,url,updated,variants,site)` (`variants` = JSON `[{k,b,z,u}]`: k=Mã NB chuẩn hóa từ barcode, b=từ sku, z=size, u=size đuôi SKU) · `Ton_Buon(key,size,ton,updated)` · `Chiet_Khau(level[default|brand|category|line],name,pct)` · `Don_Buon(id,time,name,phone,note,status,total,items JSON)`. Tự tạo khi chạy lần đầu.

## Deploy (không có "biến môi trường" ở GitHub Pages — site tĩnh)
1. Tạo Google Sheet mới → Extensions → Apps Script → dán `Code.gs`.
2. Project Settings → Script properties: `ADMIN_PIN` (đồng bộ sản phẩm không còn cần token Nhanh.vn).
3. Deploy → New deployment → Web app → Execute as **Me**, Who has access **Anyone** → copy URL `/exec`.
4. Dán URL vào `config.js` (`API_URL`).
5. Đẩy repo lên GitHub → Settings → Pages → Deploy from branch `main` / root. Khách: `/`, quản trị: `/admin.html`.
6. Sửa `Code.gs` thì phải Deploy → Manage deployments → New version.

## Gọi Haravan (Code.gs `fetchHaravan_`)
`GET https://<web>/products.json?limit=250&page=N`, tự fallback `/collections/all/products.json` (không cần xác thực; không ném lỗi, có retry + `warnings`). Trả HTML/không phải JSON → `parseJsonOrExplain_` ném lỗi kèm HTTP, tiêu đề, nội dung. `admin.html` `api()` cũng báo rõ khi Apps Script trả HTML. Mỗi lượt `syncWeb` ≤ 40 trang / 150 giây, con trỏ `{s, p}`.
