# ARCHITECTURE.md

## Luồng dữ liệu
```
 mixsport.vn ─┐                       ┌─> Sheet San_Pham   (mã, tên, ảnh, giá, phân loại)
 liningvietnam ┴─ Nhanh.vn API (200642)│
                         ▲             │
                         │ syncWeb     │
 admin.html ──POST(PIN)──┴──► Code.gs ─┼─> Sheet Ton_Buon   (key,size,tồn)  ← file tồn parse tại trình duyệt (SheetJS)
 (GitHub Pages)                  ▲     ├─> Sheet Chiet_Khau (level,name,pct)
                                 │     └─> Sheet Don_Buon   (đơn)
 index.html ──GET catalog────────┘
            ──POST order─────────►  (server tính lại giá, kiểm tồn)
```
- `GET ?action=catalog` công khai, chỉ trả size còn hàng + % chiết khấu; client cache `localStorage` (hiện ngay, làm mới nền).
- Mọi action admin là `POST` kèm `pin`, so với Script Property `ADMIN_PIN`.

## Sheets
`San_Pham(key,ma,ten,brand,category,line,gia,anh,url,updated)` · `Ton_Buon(key,size,ton,updated)` · `Chiet_Khau(level[default|brand|category|line],name,pct)` · `Don_Buon(id,time,name,phone,note,status,total,items JSON)`. Tự tạo khi chạy lần đầu.

## Deploy (không có "biến môi trường" ở GitHub Pages — site tĩnh)
1. Tạo Google Sheet mới → Extensions → Apps Script → dán `Code.gs`.
2. Project Settings → Script properties: `ADMIN_PIN`, `NHANH_BUSINESS_ID=200642`, `NHANH_APP_ID`, `NHANH_SECRET_KEY`, `NHANH_ACCESS_TOKEN`.
3. Deploy → New deployment → Web app → Execute as **Me**, Who has access **Anyone** → copy URL `/exec`.
4. Dán URL vào `config.js` (`API_URL`).
5. Đẩy repo lên GitHub → Settings → Pages → Deploy from branch `main` / root. Khách: `/`, quản trị: `/admin.html`.
6. Sửa `Code.gs` thì phải Deploy → Manage deployments → New version.
