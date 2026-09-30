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
