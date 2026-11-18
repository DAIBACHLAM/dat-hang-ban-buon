# BUSINESS_LOGIC.md — Quy tắc nghiệp vụ bất di bất dịch

## 1. Đọc & chuẩn hóa file tồn (admin.html)
1. **Đọc dọc trước, ngang sau**: mỗi sheet thử dạng dọc (cột Mã / Size / Tồn) trước; không có mới thử pivot (Mã + các cột size, vd Adidas `ARTICLE_NO`). Bỏ cột giá/năm/Total. **Tồn âm = 0.**
2. **Size**: `A/S`→`S` (tương tự `A/M`…), `XXL`→`2XL`; trống / `NO` / `FREE` → `FREESIZE`.
3. **Gộp đuôi**: `V`, `C` hoặc không đuôi sau chữ số là cùng mã: `P-AYPV009-4V` = `P-AYPV009-4C` = `P-AYPV009-4`.
4. **Tiền tố `P-`**: thiếu/thừa đều khớp (khóa chuẩn bỏ `P-`).
5. **Cộng dồn**: trong 1 file cộng tồn cùng `Mã NB + Size`. Giữa nhiều file: file cùng kho (đoán từ tên file, admin sửa được) chỉ lấy file **mới nhất** (không cộng trùng); khác kho thì cộng.

Khóa chuẩn = `canon(Mã NB)`: viết hoa, bỏ khoảng trắng, bỏ `P-` đầu, bỏ `V|C` sau chữ số cuối. Đẩy tồn = **thay thế toàn bộ** sheet `Ton_Buon`.

## 2. Đồng bộ từ web gốc
Nút "Đồng bộ sản phẩm mới" gọi Nhanh.vn (`/api/product/search`, `/api/product/category`, Business 200642) → upsert `San_Pham` theo khóa chuẩn: mã, tên, ảnh, giá niêm yết, Nhãn hàng (`brandName`), Danh mục (nhóm cha cao nhất), Dòng hàng (nhóm con; nếu thiếu suy từ tên). Mỗi lượt 5 trang, admin lặp đến hết.
⚠ Cần kiểm tra tên trường thực tế của response Nhanh.vn ở lần chạy đầu và chỉnh `syncWeb_`/`classify_` nếu lệch.

## 3. Ẩn tồn, chỉ hiện size còn hàng
Catalog công khai chỉ chứa `sizes[]` có `tồn > 0`. Sản phẩm không còn size nào, hoặc chưa có giá/chưa có trong `San_Pham`, bị ẩn. Khi đặt vượt tồn, server báo "không đủ hàng" không kèm số.

## 4. Chiết khấu
Ưu tiên: **Dòng hàng > Danh mục > Nhãn hàng > Mặc định**. Giá sỉ = `round(giá niêm yết × (100 − %)/100)`. Tính lại ở server khi chốt đơn.

## 5. Chốt đơn
Khách nhập tên + SĐT → server khóa (LockService), kiểm tra tồn từng dòng, tính giá, ghi `Don_Buon` (mã `DByyMMdd-NNN`, trạng thái `Mới`), trả hóa đơn → khách bấm "Copy đơn gửi Zalo". **Không trừ tồn tự động**; tồn chỉ đổi khi admin thả file tồn mới. Admin đối chiếu tồn từng dòng (thấy số tồn), đổi trạng thái, xuất Excel để lên đơn Nhanh.vn.
