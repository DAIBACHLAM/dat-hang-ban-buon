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

## 2026-11-18 — Đồng bộ sản phẩm chuyển sang 2 web Haravan (bỏ Nhanh.vn)
- `Code.gs`: gỡ toàn bộ code gọi Nhanh.vn. `syncWeb_` **xóa sạch `San_Pham`** ở lượt đầu rồi quét `/collections/all/products.json` của mixsport.vn và liningvietnam.com.vn (50 SP/trang, tới khi trang rỗng; con trỏ `{s,p}`, ≤150 giây/lượt). Loại SP ẩn / không ảnh / không SKU; trùng Mã NB giữa 2 web thì gộp.
- 1 card = 1 Mã NB (barcode ưu tiên, SKU bỏ hậu tố size làm dự phòng, rồi `canon`), gom mọi size vào cột mới `variants` (+ cột `site`). Web Li-Ning "gộp màu" tách theo Mã NB/màu. Phân loại Danh mục/Dòng hàng từ tên + `product_type` + `tags` (`LINE_RULES`).
- Catalog/đặt đơn/đối chiếu tồn admin khớp tồn theo `variants` (mã × size Haravan, dự phòng size đuôi SKU); ẩn SP không có size tồn > 0; vẫn không lộ số tồn.
- `admin.html`: hộp xác nhận xóa dữ liệu cũ, log đồng bộ mới, cảnh báo mã tồn không thuộc 2 web. `index.html`: đổi khóa cache `catalog2` để bỏ cache sản phẩm Nhanh.vn cũ.
- Phát hiện khi kiểm thử dữ liệu thật: `/products.json` gốc của cả 2 web trả **404** (nên dùng `/collections/all/products.json`); `barcode` Haravan là mã gốc sạch. Kiểm thử Node trên 150 SP/web: mixsport 152 card, liningvietnam 443 card, size/mã/phân loại đúng.
- Chưa làm: tra chéo danh mục chuẩn theo SKU từ Nhanh.vn. Chưa kiểm thử khớp với file tồn thật.
- Trạng thái deploy: **cần dán `Code.gs` mới vào Apps Script → Deploy → New version**, rồi bấm Đồng bộ ở admin.html (cần Cho phép quyền UrlFetch như cũ).

## 2026-11-18 — Vá lỗi sập khi phân trang Haravan ("Địa chỉ không khả dụng" ở trang 36)
- Lỗi: `UrlFetchApp.fetch` ném Exception ở trang sâu (`mixsport.vn ... page=36`) → `syncWeb_` sập trước khi ghi Sheets → mất toàn bộ sản phẩm các trang trước.
- `Code.gs`: `fetchHaravan_` không bao giờ ném lỗi (`try/catch` + `muteHttpExceptions`, header `User-Agent`), thử lại 1 lần sau 1,5 giây, trả `{ok, products, error}`. `syncWeb_`: trang lỗi (mạng / HTTP ≠ 200 / không phải JSON) → dừng web đó, **vẫn ghi mọi sản phẩm đã lấy vào Sheets** và trả `warnings`; có thêm lưới `try/catch` ngoài cùng; `Utilities.sleep(300)` giữa các trang; `limit=250`.
- Endpoint: thử `/products.json?limit=250` trước, tự chuyển sang `/collections/all/products.json?limit=250` nếu trang 1 lỗi/rỗng; con trỏ `{s,p,e}` nhớ endpoint đã chọn. Kiểm thử 18/11/2026: `/products.json` vẫn 404 trên cả 2 web, còn `/collections/all/products.json` chỉ trả tối đa **50 SP/trang dù limit=250** → số trang không giảm xuống 7–8 như dự kiến (≈36 trang cho mixsport); tốc độ nhờ vậy không tăng 5 lần, nhưng không còn mất dữ liệu khi lỗi.
- `admin.html`: log hiện cảnh báo (⚠) từng trang lỗi và tổng số thẻ đã có.
- Kiểm thử Node: giả lập lỗi "Địa chỉ không khả dụng" ở trang 3 → hàm trả `ok:false` thay vì ném lỗi. Chưa chạy đầy đủ trên Apps Script.
- Trạng thái deploy: **chưa deploy / chưa push**; cần dán `Code.gs` mới → New version.
