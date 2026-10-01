# Kịch bản kiểm thử — CloudBox

## 1. Cách chạy

- Kiểm thử tự động local: `npx tsc --noEmit`, `npx expo lint`, `docker compose up --build`.
- Chạy app iOS Simulator: `npx expo start --ios`.
- CI chạy tự động khi push/PR vào `main`: [.github/workflows/ci.yml](../.github/workflows/ci.yml).

## 2. Kịch bản chức năng

| ID | Mục tiêu | Tiền điều kiện | Bước kiểm thử | Kết quả mong đợi |
| --- | --- | --- | --- | --- |
| AUTH-01 | Đăng ký thành công | API/DB đang chạy | Nhập tên, email hợp lệ, mật khẩu ≥ 8 ký tự; nhấn Đăng ký | API trả 201, tạo user, token được lưu SecureStore, app hiện chào mừng |
| AUTH-02 | Chặn email trùng | Đã có tài khoản | Đăng ký lại email cũ | API trả 409; không tạo tài khoản/token mới |
| AUTH-03 | Validation đăng ký | API đang chạy | Dùng email sai hoặc mật khẩu ngắn | API trả 422; mobile hiển thị trạng thái lỗi dễ hiểu |
| AUTH-04 | Đăng nhập đúng | Đã có tài khoản | Nhập đúng email/mật khẩu | API trả access/refresh token, session được lưu an toàn |
| AUTH-05 | Đăng nhập sai | Đã có tài khoản | Nhập sai mật khẩu | API trả 401; không lưu token |
| AUTH-06 | Refresh token | Có refresh token hợp lệ | Gọi `/auth/refresh` | Trả token mới, token cũ bị thu hồi |
| AUTH-07 | Logout | Có refresh token hợp lệ | Gọi `/auth/logout`, sau đó refresh | Logout trả 204; refresh trả 401 |
| PROFILE-01 | Xem hồ sơ | Đã đăng nhập | Mở Cài đặt | Hiển thị tên, email và avatar hiện tại (hoặc chữ cái thay thế) |
| PROFILE-02 | Đổi tên hiển thị | Đã đăng nhập | Nhập tên hợp lệ, chọn Lưu hồ sơ | `PATCH /me` trả 200; tên mới hiển thị ngay và vẫn còn sau khi mở lại app |
| PROFILE-03 | Tên trống | Đã đăng nhập | Xóa toàn bộ tên rồi chọn Lưu | Client không gửi request; giữ trạng thái hợp lệ |
| PROFILE-04 | Tải avatar hợp lệ | Có ảnh JPG/PNG/WebP dưới 5 MB | Chọn ảnh, crop vuông và xác nhận | `PUT /me/avatar` trả 200; avatar mới hiển thị ở thanh trên và menu |
| PROFILE-05 | Avatar sai định dạng | Có file không phải JPG/PNG/WebP | Gửi `PUT /me/avatar` | Trả 415; avatar cũ không đổi |
| PROFILE-06 | Avatar quá lớn | Có ảnh lớn hơn 5 MB | Gửi `PUT /me/avatar` | Trả 413; avatar cũ không đổi |
| PROFILE-07 | Xóa avatar | Đã có avatar | Chọn Xóa ảnh | `DELETE /me/avatar` trả 200; UI hiển thị chữ cái thay thế |
| PROFILE-08 | Từ chối quyền ảnh | Quyền thư viện ảnh đang bị từ chối | Chọn ảnh | App hiển thị thông báo quyền; không crash và không gọi upload |
| PROFILE-09 | Đổi mật khẩu thành công | Đã đăng nhập, biết mật khẩu cũ | Nhập mật khẩu cũ và mật khẩu mới >= 8 ký tự, xác nhận khớp | `PATCH /me/password` trả token pair mới; đăng nhập được bằng mật khẩu mới |
| PROFILE-10 | Sai mật khẩu hiện tại | Đã đăng nhập | Nhập sai mật khẩu cũ | Trả 400; mật khẩu không đổi |
| PROFILE-11 | Xác nhận mật khẩu không khớp | Đã đăng nhập | Nhập mật khẩu xác nhận khác mật khẩu mới | Client không gọi API và nêu lỗi rõ ràng |
| PROFILE-12 | Mật khẩu yếu/trùng | Đã đăng nhập | Nhập mật khẩu mới < 8 ký tự hoặc bằng mật khẩu cũ | Client/backend từ chối (422 với request không hợp lệ); mật khẩu cũ còn hiệu lực |
| PROFILE-13 | Thu hồi phiên khác | Cùng tài khoản đăng nhập trên hai thiết bị | Đổi mật khẩu ở thiết bị A, refresh token ở B | A nhận token mới; B nhận 401 khi refresh và phải đăng nhập lại |
| SYS-01 | Health DB | Docker đang chạy | Gọi `GET /api/v1/health` | HTTP 200 và `status: ok` |
| SYS-02 | Mất backend | Tắt `api` container | Thử đăng nhập trên Simulator | App không crash; hiển thị lỗi kết nối và có thể thử lại |
| SEC-01 | Không rò mật khẩu | Có tài khoản | Kiểm tra response API/log database | Không có `password`/`password_hash` trong response hoặc log client |
| SEC-02 | Secret production | Môi trường deploy | Kiểm tra biến môi trường | `SECRET_KEY` khác giá trị development và không commit vào Git |

## 3. Kịch bản UI iOS Simulator

| ID | Bước | Kết quả mong đợi |
| --- | --- | --- |
| UI-01 | Mở app mới cài | Không còn thanh Home/Explore; thấy form đăng nhập |
| UI-02 | Chuyển giữa Đăng nhập và Đăng ký | Form cập nhật đúng; không mất dữ liệu không cần thiết |
| UI-03 | Nhấn nút khi request đang chạy | Nút mờ/không gửi lặp request |
| UI-04 | Xoay màn hình hoặc dùng dark mode | Nội dung không bị che khuất, thao tác vẫn dùng được |
| UI-05 | Đóng/mở lại app sau đăng nhập | SecureStore vẫn có session để dùng cho luồng điều hướng phiên ở bước tiếp theo |

## 4. Regression cho các tính năng kế tiếp

Khi thêm folders/files/shares, bổ sung test tối thiểu: owner tạo và xoá mềm resource; editor sửa được nhưng viewer không sửa được; user khác nhận 404/403; upload vượt quota bị từ chối; restore/xoá vĩnh viễn cập nhật quota chính xác.

## 5. CD checklist

Trước build production:

1. Kiểm tra CI xanh.
2. Set GitHub secret `EXPO_TOKEN` và environment variable `EXPO_PUBLIC_API_URL` trong environment `production`.
3. Set secret backend `SECRET_KEY`, database URL, object-storage credentials ở môi trường deploy.
4. Vào Actions → **Mobile build (EAS)** → Run workflow, chọn `ios`, `android` hoặc `all`.
5. Kiểm tra build trên Expo/EAS rồi thực hiện submit App Store/Google Play khi đã có signing credentials.
