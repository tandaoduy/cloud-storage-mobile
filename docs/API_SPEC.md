# API Specification — Cloud Storage

Base URL local: `http://127.0.0.1:8000/api/v1`  
Content type: `application/json`, trừ upload binary/multipart.

> Trạng thái: `GET /health` đã được triển khai. Những endpoint khác là API contract cho MVP, cần được triển khai ở các bước tiếp theo.

## 1. Quy ước chung

### Xác thực

Gửi header sau ở mọi API yêu cầu đăng nhập:

```http
Authorization: Bearer <access_token>
```

### Phản hồi thành công

```json
{ "data": {} }
```

Danh sách có thêm `meta`:

```json
{ "data": [], "meta": { "next_cursor": "...", "limit": 20 } }
```

### Lỗi

```json
{ "detail": "Bạn không có quyền thực hiện thao tác này." }
```

| HTTP | Ý nghĩa |
| --- | --- |
| 400 | Request/luồng nghiệp vụ không hợp lệ |
| 401 | Thiếu, sai hoặc hết hạn access token |
| 403 | Đã đăng nhập nhưng không có quyền |
| 404 | Không tìm thấy tài nguyên hoặc không được phép biết tài nguyên tồn tại |
| 409 | Trùng email, tên, hoặc xung đột dữ liệu |
| 413 | File vượt giới hạn upload |
| 422 | Dữ liệu request không qua validation |
| 429 | Vượt rate limit |
| 500 | Lỗi máy chủ |

### Phân trang và sắp xếp

- List API dùng `limit` (mặc định 20, tối đa 100) và `cursor`.
- `sort_by`: `name`, `created_at`, `updated_at`, `size_bytes`.
- `sort_order`: `asc` hoặc `desc`.

## 2. System

### `GET /health`

Kiểm tra FastAPI và kết nối PostgreSQL. Không yêu cầu token.

**Response 200**

```json
{ "status": "ok", "detail": "FastAPI đang kết nối PostgreSQL." }
```

## 3. Authentication

### `POST /auth/register`

Tạo tài khoản mới.

```json
{ "email": "mai@example.com", "password": "strong-password", "display_name": "Mai" }
```

**Response 201**: `TokenPair`.

### `POST /auth/login`

```json
{ "email": "mai@example.com", "password": "strong-password" }
```

**Response 200**

```json
{
  "data": {
    "access_token": "jwt",
    "refresh_token": "opaque-or-jwt-token",
    "token_type": "bearer",
    "expires_in": 900,
    "user": { "id": "uuid", "email": "mai@example.com", "display_name": "Mai" }
  }
}
```

### `POST /auth/refresh`

```json
{ "refresh_token": "..." }
```

Trả về token pair mới và thu hồi refresh token cũ.

### `POST /auth/logout`

Thu hồi refresh token hiện hành.

```json
{ "refresh_token": "..." }
```

Response: `204 No Content`.

## 4. Profile và quota

### `GET /me`

**Response 200**

```json
{
  "data": {
    "id": "uuid", "email": "mai@example.com", "display_name": "Mai",
    "avatar_url": null, "quota_bytes": 16106127360, "used_storage_bytes": 5242880
  }
}
```

### `PATCH /me`

Chỉ sửa trường được gửi.

```json
{ "display_name": "Mai Nguyen", "avatar_url": "https://..." }
```

### `GET /me/storage`

```json
{ "data": { "quota_bytes": 16106127360, "used_storage_bytes": 5242880, "available_bytes": 16100884480 } }
```

## 5. Folders

### `GET /folders`

Liệt kê thư mục con của `parent_id`; `parent_id` không có nghĩa là root. Không trả mục đã xoá.

Query: `parent_id`, `limit`, `cursor`, `sort_by`, `sort_order`.

### `POST /folders`

```json
{ "name": "Ảnh du lịch", "parent_id": "uuid-or-null" }
```

**Response 201**

```json
{ "data": { "id": "uuid", "name": "Ảnh du lịch", "parent_id": null, "owner_id": "uuid", "created_at": "2026-09-30T00:00:00Z" } }
```

### `GET /folders/{folder_id}`

Trả metadata thư mục sau khi kiểm tra owner/share permission.

### `PATCH /folders/{folder_id}`

Đổi tên hoặc di chuyển thư mục. Người gọi cần là owner hoặc editor.

```json
{ "name": "Ảnh 2026", "parent_id": "uuid-or-null" }
```

Không được di chuyển vào chính nó hay con cháu của nó.

### `DELETE /folders/{folder_id}`

Xoá mềm; response `204`. Có thể dùng query `recursive=true` để cho phép xoá thư mục có nội dung, nếu UI đã xác nhận.

### `GET /folders/{folder_id}/contents`

Trả danh sách kết hợp folders và files trong thư mục.

```json
{
  "data": [
    { "kind": "folder", "id": "uuid", "name": "Thiết kế", "updated_at": "..." },
    { "kind": "file", "id": "uuid", "name": "brief.pdf", "mime_type": "application/pdf", "size_bytes": 24000, "updated_at": "..." }
  ],
  "meta": { "next_cursor": null, "limit": 20 }
}
```

## 6. Files

### `GET /files`

List file của người dùng. Query hỗ trợ `folder_id`, `starred`, `limit`, `cursor`, `sort_by`, `sort_order`.

### `POST /files/upload-intents`

Tạo upload intent trước khi client gửi binary trực tiếp lên object storage.

```json
{ "name": "invoice.pdf", "folder_id": "uuid-or-null", "mime_type": "application/pdf", "size_bytes": 248192, "checksum": "optional-sha256" }
```

**Response 201**

```json
{
  "data": {
    "file_id": "uuid", "upload_url": "https://signed-storage-url", "upload_headers": {}, "expires_at": "2026-09-30T00:10:00Z"
  }
}
```

API kiểm tra quota, quyền editor của folder và loại/kích thước tệp trước khi cấp signed URL.

### `POST /files/{file_id}/complete`

Xác nhận tải lên xong; API xác minh object storage và ghi metadata/quota trong transaction.

```json
{ "etag": "optional-storage-etag" }
```

Response `200` trả `File` metadata.

### `POST /files/{file_id}/abort`

Huỷ upload intent chưa hoàn thành và dọn object tạm. Response `204`.

### `GET /files/{file_id}`

Trả File metadata nếu người gọi có owner/viewer/editor permission.

### `PATCH /files/{file_id}`

```json
{ "name": "invoice-september.pdf", "folder_id": "uuid-or-null", "is_starred": true }
```

`folder_id` yêu cầu owner/editor trên thư mục đích.

### `GET /files/{file_id}/download-url`

Trả signed download URL có hạn ngắn. Viewer, editor và owner đều dùng được.

```json
{ "data": { "url": "https://signed-storage-url", "expires_at": "2026-09-30T00:05:00Z" } }
```

### `DELETE /files/{file_id}`

Xoá mềm tệp. Response `204`.

## 7. Search, recent, starred và trash

### `GET /search`

Query bắt buộc: `q`. Query tùy chọn: `kind=file|folder`, `mime_type`, `updated_after`, `limit`, `cursor`.

Chỉ trả tài nguyên người gọi sở hữu hoặc có quyền được chia sẻ.

### `GET /recent`

Trả file/folder người dùng tạo, chỉnh sửa hoặc truy cập gần đây. Query phân trang chuẩn.

### `GET /starred`

Trả tệp đã đánh dấu sao. Việc star là trạng thái riêng của người dùng; nếu cần star với shared resources ở phiên bản sau, thêm bảng `user_resource_preferences`.

### `GET /trash`

Trả tệp/thư mục của owner có `deleted_at` khác `NULL`.

### `POST /trash/files/{file_id}/restore`

Khôi phục file. Có thể nhận body `{ "folder_id": "uuid-or-null" }` nếu thư mục gốc đã bị xoá.

### `POST /trash/folders/{folder_id}/restore`

Khôi phục folder và nội dung theo chính sách restore của backend.

### `DELETE /trash/files/{file_id}` và `DELETE /trash/folders/{folder_id}`

Xoá vĩnh viễn metadata và lên lịch xoá object storage. Chỉ owner thực hiện. Response `204`.

### `DELETE /trash`

Làm trống thùng rác của người dùng, cần header/flag xác nhận:

```json
{ "confirm": true }
```

## 8. Sharing

### `GET /shared-with-me`

Danh sách resource được người khác chia sẻ cho người dùng hiện tại. Query: `kind`, `limit`, `cursor`.

### `GET /shares?resource_type=file&resource_id={uuid}`

Owner xem danh sách quyền đã cấp cho một resource.

### `POST /shares`

```json
{ "resource_type": "file", "resource_id": "uuid", "recipient_email": "an@example.com", "permission": "viewer" }
```

Owner của resource mới được cấp share. Nếu share đã tồn tại thì cập nhật quyền hoặc trả `409`; cần chọn một chính sách thống nhất khi triển khai.

### `PATCH /shares/{share_id}`

```json
{ "permission": "editor" }
```

### `DELETE /shares/{share_id}`

Thu hồi quyền chia sẻ, response `204`.

## 9. Schema rút gọn

### `File`

```json
{
  "id": "uuid", "owner_id": "uuid", "folder_id": "uuid-or-null", "name": "invoice.pdf",
  "mime_type": "application/pdf", "size_bytes": 248192, "is_starred": false,
  "created_at": "2026-09-30T00:00:00Z", "updated_at": "2026-09-30T00:00:00Z"
}
```

### `Folder`

```json
{ "id": "uuid", "owner_id": "uuid", "parent_id": null, "name": "Ảnh", "created_at": "...", "updated_at": "..." }
```

## 10. Yêu cầu bảo mật API

- Rate limit nghiêm ngặt cho `/auth/login`, `/auth/register` và upload intent.
- Không trả `storage_key`, `password_hash`, refresh token hash hoặc signed URL trong endpoint metadata thông thường.
- Kiểm tra authorization ở service layer của backend trước mỗi truy vấn/động tác object storage.
- Mobile lưu token trong secure storage, không dùng AsyncStorage cho refresh token.
- Log có correlation/request ID, không log thông tin nhạy cảm.
