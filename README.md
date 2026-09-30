# Cloud Storage

## Chạy local

1. Khởi động FastAPI và PostgreSQL: `docker compose up --build`
2. Kiểm tra API: `http://127.0.0.1:8000/api/v1/health`
3. Trong terminal khác, mở mobile: `npx expo start --ios`

Mobile mặc định dùng `http://127.0.0.1:8000/api/v1`, đúng cho iOS Simulator. Với máy thật hoặc backend deploy, đặt `EXPO_PUBLIC_API_URL` là URL API thích hợp.

`src/services` là nơi gọi REST API; `backend/app/api` là nơi đặt endpoint; `backend/app/db` dành cho database, models và migration tiếp theo.

Khi API chạy, migration `001_users_auth` tự tạo bảng `users` và `refresh_tokens`. Mở app trong iOS Simulator để đăng ký hoặc đăng nhập; token phiên được lưu bằng Expo SecureStore.

Trước khi deploy, đặt `SECRET_KEY` ngẫu nhiên, riêng tư trong môi trường backend; không dùng giá trị development mặc định.
