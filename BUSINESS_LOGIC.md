# BUSINESS_LOGIC.md — Quy tắc nghiệp vụ bất di bất dịch

## 1. Đọc & chuẩn hóa file tồn (admin.html)
1. **Đọc dọc trước, ngang sau**: mỗi sheet thử dạng dọc (cột Mã / Size / Tồn) trước; không có mới thử pivot (Mã + các cột size, vd Adidas `ARTICLE_NO`). Bỏ cột giá/năm/Total. **Tồn âm = 0.**
2. **Size**: `A/S`→`S` (tương tự `A/M`…), `XXL`→`2XL`; trống / `NO` / `FREE` → `FREESIZE`.
3. **Gộp đuôi**: `V`, `C` hoặc không đuôi sau chữ số là cùng mã: `P-AYPV009-4V` = `P-AYPV009-4C` = `P-AYPV009-4`.
4. **Tiền tố `P-`**: thiếu/thừa đều khớp (khóa chuẩn bỏ `P-`).
5. **Cộng dồn**: trong 1 file cộng tồn cùng `Mã NB + Size`. Giữa nhiều file: file cùng kho (đoán từ tên file, admin sửa được) chỉ lấy file **mới nhất** (không cộng trùng); khác kho thì cộng.

Khóa chuẩn = `canon(Mã NB)`: viết hoa, bỏ khoảng trắng, bỏ `P-` đầu, bỏ `V|C` sau chữ số cuối. Đẩy tồn = **thay thế toàn bộ** sheet `Ton_Buon`.

## 2. Đồng bộ sản phẩm từ 2 web Haravan (KHÔNG tải kho Nhanh.vn)
Nút "Đồng bộ sản phẩm mới từ Web gốc" (có hộp xác nhận):
1. **Lượt đầu XÓA SẠCH** sheet `San_Pham` (loại sản phẩm rác cũ từ Nhanh.vn), rồi quét 2 web: thử `/products.json?limit=250` trước, nếu lỗi/rỗng tự dùng `/collections/all/products.json?limit=250` (hiện `/products.json` trả 404 và Haravan giới hạn 50 SP/trang), tăng trang tới khi trang rỗng. Trang lỗi (mạng/HTTP≠200) **không làm sập**: thử lại 1 lần, rồi dừng web đó, vẫn lưu mọi SP đã lấy và báo cảnh báo; nghỉ 300ms giữa các trang. Mỗi lượt ≤ ~150 giây; admin gọi lặp theo con trỏ `{web, trang}`.
2. **Loại**: `published_at == null` (ẩn), không có ảnh, không có SKU/barcode.
3. **Mã NB (khóa)**: ưu tiên `barcode` của variant (đã là mã gốc sạch, vd `P-AKPW001-12V`); nếu trống lấy `sku` và bỏ hậu tố size của chính variant (`-39`, `-S`, ` A/S`…; chỉ bỏ khi đúng bằng size của variant nên không đụng mã màu `-4`). Sau đó `canon()` (bỏ `P-`, gộp đuôi `V`/`C`). Mọi variant cùng Mã NB → **1 card**, các size nằm trong `variants`. Cùng Mã NB xuất hiện ở cả 2 web → gộp, không nhân đôi.
4. **Web Li-Ning "GỘP MÀU"** (1 product chứa nhiều màu = nhiều Mã NB): tách mỗi **Mã NB/màu** thành 1 card (tên = tên SP + " - " + màu, ảnh = ảnh của variant nếu có) để size/tồn không lẫn giữa các màu. Không bao giờ tách theo size.
5. **Size**: lấy từ option "Kích thước/Size" của variant, chuẩn hóa như file tồn (quy tắc 2; `Chung` = FREESIZE). Sản phẩm chỉ có option Màu: lấy size từ đuôi SKU, không có = FREESIZE. Đuôi size trong SKU (vd UK 4.5 trong `...V4.5` khi option là EU 36) được lưu thêm làm size dự phòng để khớp file tồn.
6. **Dữ liệu lấy từ Haravan**: tên (`title`), Nhãn hàng (`vendor`, web Li-Ning mặc định "Li-Ning"), giá niêm yết = max(`price`, `compare_at_price`), ảnh (ảnh của variant, không có thì `images[0].src`), link. **Danh mục / Dòng hàng**: phân loại theo từ khóa trên tên SP rồi `product_type` + `tags` (bảng `LINE_RULES` trong `Code.gs`); không khớp → Dòng hàng = `product_type`, Danh mục = "Khác".
7. Không gọi Nhanh.vn nữa (đã gỡ code). Tra chéo danh mục theo SKU từ Nhanh.vn **chưa làm** — phân loại hiện lấy từ Haravan; nếu cần danh mục chuẩn Nhanh.vn sẽ làm sau, chỉ tra đúng các SKU đã lấy.

## 3. Hiển thị trên trang khách & ẩn tồn
Sản phẩm chỉ hiện khi thuộc `San_Pham` (đã từ 2 web) **và** có ≥1 size có tồn > 0 trong `Ton_Buon`. Khớp tồn theo từng variant: (Mã NB barcode/sku chuẩn hóa) × (size Haravan, rồi size đuôi SKU); mỗi cặp mã+size chỉ tính 1 lần. Catalog công khai chỉ chứa `sizes[]` còn hàng, **không số tồn**. Khi đặt vượt tồn server báo "không đủ hàng" không kèm số. Mã có tồn nhưng không thuộc sản phẩm nào trên 2 web sẽ không hiển thị (admin thấy số lượng mã này).

## 4. Chiết khấu
Ưu tiên: **Dòng hàng > Danh mục > Nhãn hàng > Mặc định**. Giá sỉ = `round(giá niêm yết × (100 − %)/100)`. Tính lại ở server khi chốt đơn.

## 5. Chốt đơn
Khách nhập tên + SĐT → server khóa (LockService), kiểm tra tồn từng dòng, tính giá, ghi `Don_Buon` (mã `DByyMMdd-NNN`, trạng thái `Mới`), trả hóa đơn → khách bấm "Copy đơn gửi Zalo". **Không trừ tồn tự động**; tồn chỉ đổi khi admin thả file tồn mới. Admin đối chiếu tồn từng dòng (thấy số tồn), đổi trạng thái, xuất Excel để lên đơn Nhanh.vn.
