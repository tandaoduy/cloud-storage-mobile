# Software Requirements Specification (SRS) — CloudBox

## 1. Mục đích

CloudBox là ứng dụng lưu trữ đám mây trên thiết bị di động, lấy cảm hứng từ Google Drive. Người dùng có thể quản lý thư mục và tệp cá nhân, theo dõi dung lượng, tìm kiếm và chia sẻ nội dung theo quyền được cấp.

Tài liệu này là cơ sở để thiết kế UI, API, cơ sở dữ liệu, kiểm thử và triển khai sản phẩm.

## 2. Phạm vi

### 2.1 Trong phạm vi phiên bản đầu (MVP)

- Đăng ký, đăng nhập, đăng xuất.
- Tạo, đổi tên, duyệt và xoá mềm thư mục.
- Tải lên, xem metadata, tải xuống, đổi tên, di chuyển và xoá mềm tệp.
- Danh sách gần đây, mục đã đánh dấu sao, thùng rác và tìm kiếm.
- Hiển thị dung lượng đã dùng / tổng dung lượng.
- Chia sẻ tệp hoặc thư mục cho người dùng khác theo quyền xem hoặc chỉnh sửa.

### 2.2 Ngoài phạm vi MVP

- Đồng bộ ngoại tuyến hoàn chỉnh.
- Chỉnh sửa tài liệu thời gian thực.
- Nhận dạng nội dung bằng AI/OCR.
- Gói thanh toán và nâng cấp dung lượng.
- Chia sẻ công khai bằng liên kết không cần tài khoản (có thể bổ sung sau).

## 3. Người dùng và vai trò

| Vai trò | Mô tả | Quyền chính |
| --- | --- | --- |
| Người dùng | Chủ sở hữu không gian lưu trữ | Quản lý nội dung của mình, chia sẻ nội dung |
| Người được chia sẻ | Người nhận quyền từ chủ sở hữu | Xem hoặc chỉnh sửa trong phạm vi được cấp |
| Quản trị viên | Vai trò vận hành hệ thống (giai đoạn sau) | Quản lý người dùng, quota và sự cố |

## 4. Kiến trúc và công nghệ

```text
Expo / React Native (iOS, Android)
            │ HTTPS + JSON / multipart upload
            ▼
FastAPI (REST API, JWT, phân quyền)
       ├────┴────┐
       ▼         ▼
 PostgreSQL   Object storage (S3, R2 hoặc MinIO)
 metadata,    nội dung nhị phân của tệp
 quyền, quota
```

- Mobile: Expo SDK 57, React Native, Expo Router, TypeScript.
- API: FastAPI, Pydantic, SQLAlchemy async, Alembic migration.
- Database: PostgreSQL.
- Storage: S3-compatible object storage. PostgreSQL không lưu binary của file.
- Local development: Docker Compose chạy API và PostgreSQL; có thể thêm MinIO khi triển khai upload.

## 5. Yêu cầu chức năng

### FR-01 — Xác thực

- Người dùng có thể đăng ký bằng email và mật khẩu.
- Người dùng có thể đăng nhập, đăng xuất và làm mới phiên đăng nhập.
- API cấp access token JWT ngắn hạn và refresh token an toàn.
- Mật khẩu phải được băm; không lưu hoặc trả về mật khẩu dạng rõ.

### FR-02 — Hồ sơ và quota

- Mỗi người dùng có hồ sơ gồm tên hiển thị, email, ảnh đại diện tùy chọn và quota.
- Hệ thống cập nhật `used_storage_bytes` sau khi upload, xoá vĩnh viễn hoặc khôi phục tệp.
- Upload phải bị từ chối nếu vượt quota.

### FR-03 — Thư mục

- Người dùng tạo thư mục tại thư mục gốc hoặc trong thư mục khác mà họ có quyền chỉnh sửa.
- Người dùng xem được nội dung thư mục theo phân trang và sắp xếp.
- Người dùng có thể đổi tên, di chuyển và xoá mềm thư mục.
- Không cho phép đưa thư mục vào chính nó hoặc thư mục con của nó.

### FR-04 — Tệp

- Người dùng chọn tệp từ thiết bị và tải lên.
- Hệ thống lưu tên, kích thước, loại MIME, chủ sở hữu, đường dẫn object storage, thời điểm tạo/cập nhật và trạng thái xoá.
- Người dùng có thể xem metadata, đổi tên, di chuyển, đánh dấu sao, tải xuống và xoá mềm tệp.
- Khi upload thất bại, client hiển thị lỗi và cho phép thử lại.

### FR-05 — Tìm kiếm và bộ lọc

- Người dùng tìm kiếm tệp/thư mục mà mình sở hữu hoặc được chia sẻ.
- Có thể lọc tối thiểu theo loại tệp, trạng thái sao và thời điểm cập nhật.
- Kết quả không được để lộ nội dung người dùng không có quyền truy cập.

### FR-06 — Gần đây, sao và thùng rác

- Recent hiển thị tệp/thư mục truy cập hoặc cập nhật gần đây.
- Starred hiển thị mục người dùng đã đánh dấu sao.
- Trash hiển thị mục đã xoá mềm; người dùng có thể khôi phục hoặc xoá vĩnh viễn mục thuộc quyền sở hữu.

### FR-07 — Chia sẻ và phân quyền

- Chủ sở hữu có thể mời người dùng khác theo email.
- Quyền gồm `viewer` (xem/tải xuống) và `editor` (tạo, upload, đổi tên, di chuyển trong phạm vi được chia sẻ).
- Chủ sở hữu có thể thay đổi hoặc thu hồi quyền bất kỳ lúc nào.
- Quyền của thư mục được áp dụng cho nội dung bên trong, trừ khi thiết kế quyền chi tiết hơn được bổ sung sau.

## 6. Yêu cầu giao diện mobile

- Tab chính: Home/My Drive, Shared, Search và Account (có thể điều chỉnh theo thiết kế UI).
- Home hiển thị thanh dung lượng, mục gần đây và danh sách thư mục/tệp.
- Có nút hành động nổi để tạo thư mục hoặc upload.
- Danh sách tệp có biểu tượng loại file, tên, metadata và menu thao tác.
- Giao diện hỗ trợ loading, empty state, lỗi mạng và pull-to-refresh.
- Tất cả thao tác phá huỷ như xoá vĩnh viễn phải yêu cầu xác nhận.

## 7. API sơ bộ

Mọi endpoint ngoại trừ auth yêu cầu `Authorization: Bearer <access_token>`. Prefix API là `/api/v1`.

| Nhóm | Endpoint chính | Mục đích |
| --- | --- | --- |
| System | `GET /health` | Kiểm tra FastAPI và PostgreSQL |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` | Xác thực |
| Me | `GET /me`, `PATCH /me` | Hồ sơ, quota |
| Folders | `GET/POST /folders`, `PATCH/DELETE /folders/{id}` | Quản lý thư mục |
| Files | `GET /files`, `POST /files/upload`, `GET/PATCH/DELETE /files/{id}` | Quản lý tệp |
| Search | `GET /search?q=` | Tìm kiếm có phân quyền |
| Shares | `GET/POST /shares`, `PATCH/DELETE /shares/{id}` | Cấp và thu hồi quyền |
| Trash | `GET /trash`, `POST /trash/{id}/restore` | Thùng rác |

API phản hồi JSON theo dạng `{ "data": ..., "meta": ... }`; lỗi theo dạng `{ "detail": "Thông báo lỗi" }`. Các danh sách hỗ trợ `limit`, `cursor` hoặc `page`/`page_size` nhất quán.

## 8. Mô hình dữ liệu sơ bộ

| Bảng | Trường quan trọng |
| --- | --- |
| `users` | id, email, password_hash, display_name, quota_bytes, used_storage_bytes, created_at |
| `folders` | id, owner_id, parent_id, name, is_deleted, created_at, updated_at |
| `files` | id, owner_id, folder_id, name, mime_type, size_bytes, storage_key, is_starred, is_deleted, created_at, updated_at |
| `shares` | id, resource_type, resource_id, recipient_id, permission, created_by, created_at |
| `refresh_tokens` | id, user_id, token_hash, expires_at, revoked_at |
| `activity_logs` | id, actor_id, action, resource_type, resource_id, created_at |

Ràng buộc quan trọng: email là duy nhất; `parent_id` tham chiếu `folders`; tệp chỉ có một chủ sở hữu; `storage_key` là duy nhất; `permission` chỉ nhận `viewer` hoặc `editor`.

## 9. Yêu cầu phi chức năng

### Bảo mật

- Dùng HTTPS khi deploy.
- Kiểm tra quyền ở backend cho mọi thao tác, không chỉ ẩn nút ở mobile.
- Dùng signed URL có thời hạn để upload/download object storage.
- Giới hạn kích thước, MIME type cho phép và tốc độ request upload.
- Không ghi access token, mật khẩu, signed URL hoặc dữ liệu nhạy cảm vào log.

### Hiệu năng và độ tin cậy

- API đọc metadata thông thường có thời gian phản hồi mục tiêu dưới 500 ms ở tải thông thường.
- Danh sách và tìm kiếm phải phân trang.
- Upload lớn cần có tiến trình và cơ chế retry; sau MVP có thể dùng multipart/resumable upload.
- Sao lưu PostgreSQL định kỳ; object storage có lifecycle/versioning theo chính sách vận hành.

### Khả dụng

- UI hỗ trợ iOS và Android, ưu tiên thao tác một tay và vùng chạm tối thiểu 44×44 pt.
- Có thông báo rõ ràng cho mất mạng, hết quota, hết hạn token và không đủ quyền.
- Timezone lưu ở UTC; UI hiển thị theo locale của thiết bị.

## 10. Tiêu chí nghiệm thu MVP

1. Người dùng tạo tài khoản và đăng nhập thành công.
2. Người dùng tạo thư mục, upload một tệp, thấy tệp trong danh sách và tải xuống được.
3. `GET /api/v1/health` trả `status: ok` khi PostgreSQL sẵn sàng.
4. Người dùng không thể đọc, tải hoặc sửa tài nguyên không thuộc quyền sở hữu/chia sẻ.
5. Dung lượng sử dụng tăng sau upload và giảm sau xoá vĩnh viễn.
6. Người dùng chia sẻ tệp cho người khác với quyền viewer; người nhận chỉ xem/tải được, không thể đổi tên hoặc xoá.
7. Tất cả luồng có loading, empty state và lỗi có thể hiểu được trên iOS Simulator.

## 11. Các bước triển khai tiếp theo

1. Thêm Alembic, model `users`, migration đầu tiên và auth JWT.
2. Thiết kế màn hình đăng nhập và Home/My Drive.
3. Thêm `folders`, `files`, MinIO local và luồng upload signed URL.
4. Thêm shares, search, trash và test integration.
