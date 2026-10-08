# Kịch bản kiểm thử API Thùng rác

## Điều kiện chuẩn bị

1. Khởi động backend bằng `docker compose up --build` để Alembic chạy migration `009_add_file_trash`.
2. Đăng ký hoặc đăng nhập, rồi lấy `access_token` từ phản hồi.
3. Gán biến môi trường trong terminal:

```bash
export API_URL=http://127.0.0.1:8000/api/v1
export TOKEN='<access_token>'
```

## Kịch bản chính: xoá, khôi phục, xoá vĩnh viễn

1. Tải lên một tệp và lưu `id` trong phản hồi vào `FILE_ID`.

```bash
curl -X POST "$API_URL/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./sample.pdf" \
  -F "original_name=sample.pdf"
export FILE_ID='<id_tu_phan_hoi>'
```

2. Chuyển tệp vào Thùng rác. Kỳ vọng HTTP `200`, có `deleted_at`, và không giảm `used_storage_bytes`.

```bash
curl -X DELETE "$API_URL/files/$FILE_ID" -H "Authorization: Bearer $TOKEN"
```

3. Kiểm tra danh sách chính. Kỳ vọng tệp không còn xuất hiện.

```bash
curl "$API_URL/files" -H "Authorization: Bearer $TOKEN"
```

4. Kiểm tra Thùng rác. Kỳ vọng tệp xuất hiện cùng `deleted_at` khác `null`.

```bash
curl "$API_URL/files/trash" -H "Authorization: Bearer $TOKEN"
```

5. Khôi phục tệp. Kỳ vọng HTTP `200`, `deleted_at: null`; tệp trở lại `GET /files` và biến mất khỏi `GET /files/trash`.

```bash
curl -X POST "$API_URL/files/$FILE_ID/restore" -H "Authorization: Bearer $TOKEN"
```

6. Chuyển lại vào Thùng rác, rồi xoá vĩnh viễn. Kỳ vọng HTTP `200`, dung lượng trả về giảm đúng bằng `size_bytes` của tệp; tệp không còn trong cả hai danh sách và endpoint download trả HTTP `404`.

```bash
curl -X DELETE "$API_URL/files/$FILE_ID" -H "Authorization: Bearer $TOKEN"
curl -X DELETE "$API_URL/files/$FILE_ID/permanent" -H "Authorization: Bearer $TOKEN"
curl -i "$API_URL/files/$FILE_ID/download" -H "Authorization: Bearer $TOKEN"
```

7. Đưa từ hai tệp trở lên vào Thùng rác, rồi xoá tất cả. Kỳ vọng HTTP `200`, `GET /files/trash` trả mảng rỗng và dung lượng giảm bằng tổng kích thước các tệp đã xoá.

```bash
curl -X DELETE "$API_URL/files/trash" -H "Authorization: Bearer $TOKEN"
```

## Kịch bản lỗi và phân quyền

- Gọi `DELETE /files/{id}/permanent` khi file chưa ở Thùng rác: kỳ vọng `404`.
- Khôi phục hoặc xoá vĩnh viễn cùng một tệp hai lần: lần thứ hai kỳ vọng `404`.
- Dùng token của tài khoản khác với mọi endpoint trên: kỳ vọng `404`; không được lộ sự tồn tại của tệp.
- Sau khi chuyển vào Thùng rác, gọi `GET /files/{id}`, tải xuống hoặc đổi tên: kỳ vọng `404`.
