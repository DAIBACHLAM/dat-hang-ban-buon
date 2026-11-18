# CLAUDE.md — Web Đặt Hàng Bán Buôn

## Mục tiêu
Web đặt hàng bán buôn (HTML/CSS/JS thuần) deploy GitHub Pages; backend Google Apps Script + Google Sheets; dữ liệu sản phẩm (tên/ảnh/giá/size/phân loại) đồng bộ từ products.json của 2 web Haravan `mixsport.vn` & `liningvietnam.com.vn` (KHÔNG tải kho Nhanh.vn); tồn lấy từ file tồn thả ở admin.

## Cấu trúc file
- `index.html` — trang khách (nhãn hàng → danh mục → dòng hàng, card sản phẩm, popup chọn size, giỏ, chốt đơn, copy Zalo).
- `admin.html` — quản trị (PIN): thả tồn (SheetJS), chiết khấu, đơn buôn, xuất Excel.
- `Code.gs` — Apps Script: API catalog/order/admin, sync Haravan.
- `config.js` — chỉ chứa `API_URL` công khai. Secret nằm ở Script Properties.
- `BUSINESS_LOGIC.md`, `ARCHITECTURE.md`, `CHANGELOG.md` — tài liệu bộ nhớ dự án.

## Quy ước code
- Không framework, không build step. JS trong 1 IIFE, `'use strict'`. Escape mọi chuỗi đưa vào HTML (`esc`).
- POST tới Apps Script dùng body JSON text/plain (không header Content-Type) để tránh preflight CORS.
- `canon()` (admin.html) và `canon_()` (Code.gs) PHẢI luôn giống nhau.
- Giá/chiết khấu luôn tính lại phía server khi chốt đơn; không tin số từ client.

## ĐIỀU CẤM
- KHÔNG BAO GIỜ lộ số tồn thực tế ra UI khách hay API công khai (không số, không tooltip, không thuộc tính HTML, không trong JSON catalog). Chỉ trả danh sách size còn hàng (`tồn > 0`). Thông báo lỗi thiếu hàng không được nêu số lượng.
- KHÔNG chèn banner/slider/hero/quảng cáo vào `index.html`.
- KHÔNG gọi/tải toàn bộ sản phẩm từ Nhanh.vn; nguồn sản phẩm duy nhất là 2 web Haravan.
- KHÔNG đặt PIN, secret vào file trong repo.

## BẮT BUỘC sau mỗi lượt thêm/sửa/xóa tính năng hoặc sửa lỗi
Trước khi kết thúc lượt, cập nhật đồng bộ `CLAUDE.md` (nếu quy ước đổi), `BUSINESS_LOGIC.md`, `ARCHITECTURE.md`, `CHANGELOG.md` (thêm mục mới có ngày giờ, file sửa, logic đổi, trạng thái deploy).
