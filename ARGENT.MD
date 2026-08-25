# APP QUẢN LÍ LỚP HỌC
- ADMIN: Người có quyền cao nhất, quản lí
  + Tài khoản: Giáo viên
  + Các loại, thành tích và vi phạm (Tên, thêm loại thành tích & vi phạm, số điểm cộng/trừ mỗi vi phạm/thành tích)
  + Điểm tối đa mỗi học sinh và của lớp
  + Năm học, tên lớp học, khối (10, 11, 12)
  + Số tuần trong năm học
- GIÁO VIÊN (TEACHER): Người có quyền sau ADMIN, quản lí
  + Số range mỗi tổ (ví dụ 6x2, 6 bàn mỗi bàn 2 chỗ...)
  + Tổ của lớp vị trí mỗi học sinh (có thể tạo 1 không gian sau khi thêm học sinh sẽ có các cái item học sinh drag-drop vào từng vị trí)
  + Học sinh mỗi tổ (Thêm xoá sửa học sinh gồm tên, hình ảnh, ngày sinh, giới tính, địa chỉ)
  + Duyệt các vi phạm, thành tích từ các tổ trưởng trong mỗi tuần
- HỌC SINH (STUDENT):
  - Lớp trưởng: Nhận xét chung tình hình của lớp trong tuần qua, cuối mỗi tuần
  - Lớp phó học tập:  Nhận xét chung tình hình học tập của lớp trong tuần qua, cuối mỗi tuần
  - Lớp phó lao động: Thêm xoá sửa buổi lao động (Tên buổi lao động, ngày lao động, buổi, thời gian, đánh giá mỗi học sinh theo cấp độ A B C)
  - Lớp phó văn thể: Thêm xoá sửa lần văn nghệ...
  - Thủ quỹ: Quản lý mỗi lần chi tiêu (+ tiền, - tiền, nội dung chi tiêu, ...)
  - Tổ trưởng: Quản lí vi phạm/thành tích cuối mỗi tuần
  - Bí thư/Phó Bí Thư/Uỷ viên: Thêm xoá sửa thông báo cho học sinh/giáo viên mỗi tuần (nội dung thông báo, thời gian tự động hết thông báo, có thể thêm editor dạng markdown để có thể copy paste cho dễ,...)
- CHUNG:
  - Hiển thị toàn bộ nội dung vi phạm, thành tích (mỗi học sinh có thể nhìn thấy điểm thành tích vi phạm của họ và mọi người trong tổ, riêng giáo viên có thể xem điểm chung của lớp, chi tiết của từng tổ, thành viên).
  - Hiển thị những nội dung mỗi tuần cùa lớp trưởng, lớp phó, tổ trưởng khi nhấn vào theo tuần.
  - Thêm mục "Thủ quỹ" xem hết toàn bộ nội dung chi tiêu.
  - Thêm mục "Đời sống": gồm Lao động, Văn thể.
- Ý tưởng khác: Nếu bạn có những sáng tạo có thể chỉnh sửa làm sao phù hợp nhất
- Công nghệ:
  + Dùng Web (tôi có cài NodeJS, bạn có thể dùng gì thì tuỳ).
  + Khi thêm xoá sửa nên dùng theo sync... Không nên Refresh trang lại.
  + Database tuỳ bạn chọn, có thể bạn đưa ra lựa chọn những dịch vụ database, web free 100% uptime nhé!
  + Dữ liệu chắc không lớn đâu nên bạn có thể dùng phương thức mã hoá data, tầm khoảng 1GB là được.
