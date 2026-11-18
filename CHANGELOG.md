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
