# CHANGELOG

## 2026-11-18 — Khởi tạo dự án (v0.1)
- Thêm `Code.gs`: catalog công khai (không lộ tồn), đặt đơn có khóa + kiểm tồn + tính giá server, admin (PIN, thả tồn, chiết khấu, đơn), sync Nhanh.vn.
- Thêm `index.html`: lọc 3 tầng Nhãn hàng/Danh mục/Dòng hàng, card 1:1, popup chọn nhiều size, giỏ nhóm theo danh mục/dòng, chốt đơn + copy Zalo, cache localStorage, lazy load + infinite scroll.
- Thêm `admin.html`: kéo thả nhiều file tồn, 5 quy tắc chuẩn hóa, chọn kho tránh cộng trùng, chiết khấu theo nhãn/danh mục/dòng, quản lý đơn + xuất Excel.
- Thêm `config.js`, `CLAUDE.md`, `BUSINESS_LOGIC.md`, `ARCHITECTURE.md`.
- Trạng thái deploy: **chưa deploy**; chưa chạy thử với dữ liệu thật; tên trường API Nhanh.vn chưa xác minh.

## 2026-11-18 — Gắn API_URL + đưa code lên GitHub
- `config.js`: `API_URL` = URL Web app Apps Script đã deploy (`.../macros/s/AKfycbxTJRFBY--KFgEc9tSHY1188huLE4cw5C5746smX7l_u3bYNfw2SNREeqoaA3q05CYn/exec`).
- Đẩy toàn bộ code lên repo `https://github.com/DAIBACHLAM/dat-hang-ban-buon` (nhánh `main`). Không có PIN / token / secret trong repo (nằm ở Script Properties).
- Trạng thái deploy: Apps Script đã deploy Web app; GitHub Pages chưa bật (cần bật trong Settings → Pages của repo).

## 2026-11-18 — Sửa Đồng bộ sản phẩm: chuyển Nhanh.vn API v3.0 + log lỗi HTML
- Lỗi: bấm "Đồng bộ sản phẩm mới từ Web gốc" báo `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Nguyên nhân: `Code.gs` gọi API v2.0 cũ `https://open.nhanh.vn/api/product/search` — nay trả trang HTML 404.
- `Code.gs`: `nhanh_` gọi v3.0 giống phần mềm kho / báo cáo doanh số (`https://pos.open.nhanh.vn/v3.0/...?appId=&businessId=`, header `Authorization`, body JSON), tự chờ khi `ERR_429`; thêm `parseJsonOrExplain_`, `nhanhAll_`, `loadBrands_`; `syncWeb_` dùng `/v3.0/product/list` + con trỏ `next`, map `prices.retail`, `images.avatar`, tên hãng theo `brandId`; danh mục `/v3.0/product/category`.
- `admin.html`: `api()` báo rõ khi Apps Script trả HTML (HTTP, tiêu đề, nội dung + gợi ý kiểm tra deploy); vòng đồng bộ gửi lại `next`.
- Kiểm thử: chạy `Code.gs` bằng Node với dữ liệu thật Nhanh.vn — 1 lượt 500 sản phẩm, có con trỏ lượt sau.
- Trạng thái deploy: **cần dán `Code.gs` mới vào Apps Script → Deploy → Manage deployments → New version**; Script Properties phải là cặp App ID + Access Token v3.0.
