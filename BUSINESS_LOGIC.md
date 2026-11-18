# BUSINESS_LOGIC.md — Quy tắc nghiệp vụ bất di bất dịch

## 1. Đọc & chuẩn hóa file tồn (admin.html)
1. **Đọc dọc trước, ngang sau**: mỗi sheet thử dạng dọc (cột Mã / Size / Tồn) trước; không có mới thử pivot (Mã + các cột size, vd Adidas `ARTICLE_NO`). Bỏ cột giá/năm/Total. **Tồn âm = 0.**
2. **Size**: `A/S`→`S` (tương tự `A/M`…), `XXL`→`2XL`; trống / `NO` / `FREE` → `FREESIZE`.
3. **Gộp đuôi**: `V`, `C` hoặc không đuôi sau chữ số là cùng mã: `P-AYPV009-4V` = `P-AYPV009-4C` = `P-AYPV009-4`.
4. **Tiền tố `P-`**: thiếu/thừa đều khớp (khóa chuẩn bỏ `P-`).
5. **Cộng dồn**: trong 1 file cộng tồn cùng `Mã NB + Size`. Giữa nhiều file: file cùng kho (đoán từ tên file, admin sửa được) chỉ lấy file **mới nhất** (không cộng trùng); khác kho thì cộng.

Khóa chuẩn = `canon(Mã NB)`: viết hoa, bỏ khoảng trắng, bỏ `P-` đầu, bỏ `V|C` sau chữ số cuối. Đẩy tồn = **thay thế toàn bộ** sheet `Ton_Buon`.

## 2. Đồng bộ từ web gốc
Nút "Đồng bộ sản phẩm mới" gọi **Nhanh.vn Open API v3.0** (Business 200642), giống phần mềm kho / báo cáo doanh số: `POST https://pos.open.nhanh.vn/v3.0/product/list?appId=..&businessId=..`, header `Authorization: <accessToken>`, body JSON `{filters, paginator:{size:100, next}}`; danh mục `/v3.0/product/category`, nhãn hàng `/v3.0/product/brand`. Upsert `San_Pham` theo khóa chuẩn: mã (`code`), tên (`name`), ảnh (`images.avatar`, không có thì ảnh đầu `images.others`), giá niêm yết (`prices.retail`), Nhãn hàng (tên theo `brandId`), Danh mục (nhóm cha cao nhất theo `categoryId`), Dòng hàng (nhóm con; nếu thiếu suy từ tên). Mỗi lượt tối đa 5 trang (500 SP), phân trang bằng con trỏ `paginator.next` — admin gửi lại `next` đến khi `null`.
- API v2.0 cũ (`https://open.nhanh.vn/api/product/search`) đã bỏ: trả trang HTML 404 → lỗi `Unexpected token '<'`.
- Lỗi rõ ràng: Nhanh.vn hoặc Apps Script trả **HTML thay vì JSON** → log hiện nguồn (Nhanh.vn + đường dẫn / Apps Script + action), HTTP status, tiêu đề trang và 300 ký tự nội dung; Nhanh trả `code != 1` → log `errorCode` + `messages`; `ERR_429` → tự chờ `lockedSeconds` rồi gọi lại (tối đa 3 lần), giãn cách 250 ms / request.
- Kiểm thử 18/11/2026 với dữ liệu thật: 1 lượt = 500 sản phẩm (đủ mã, tên, nhãn hàng, giá, danh mục); 500 SP đầu không có ảnh trên Nhanh, SP có ảnh (VD `P-AYPW051-4V`) trả đúng `images.avatar`.

## 3. Ẩn tồn, chỉ hiện size còn hàng
Catalog công khai chỉ chứa `sizes[]` có `tồn > 0`. Sản phẩm không còn size nào, hoặc chưa có giá/chưa có trong `San_Pham`, bị ẩn. Khi đặt vượt tồn, server báo "không đủ hàng" không kèm số.

## 4. Chiết khấu
Ưu tiên: **Dòng hàng > Danh mục > Nhãn hàng > Mặc định**. Giá sỉ = `round(giá niêm yết × (100 − %)/100)`. Tính lại ở server khi chốt đơn.

## 5. Chốt đơn
Khách nhập tên + SĐT → server khóa (LockService), kiểm tra tồn từng dòng, tính giá, ghi `Don_Buon` (mã `DByyMMdd-NNN`, trạng thái `Mới`), trả hóa đơn → khách bấm "Copy đơn gửi Zalo". **Không trừ tồn tự động**; tồn chỉ đổi khi admin thả file tồn mới. Admin đối chiếu tồn từng dòng (thấy số tồn), đổi trạng thái, xuất Excel để lên đơn Nhanh.vn.
