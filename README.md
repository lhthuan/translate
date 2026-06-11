# Gemini Translator

Ứng dụng HTML/CSS/JavaScript để dịch nhanh văn bản bằng Google AI Studio (Gemini API).

## Tính năng

- Nhập/paste văn bản cần dịch
- Chọn ngôn ngữ đích (Anh, Pháp, Đức, Nhật, Hàn, Trung, Tây Ban Nha, Ý, Bồ Đào Nha, Việt)
- Dịch bằng Gemini API
- Hiển thị ngôn ngữ nguồn được phát hiện
- Sao chép kết quả dịch
- Thông báo loading + xử lý lỗi (thiếu API key, lỗi mạng/API)
- Responsive cho mobile/desktop
- Lưu API key (đã mã hóa bằng PIN) và lịch sử dịch gần đây bằng Local Storage

## Cách lấy Google AI API key

1. Truy cập: https://aistudio.google.com/app/apikey
2. Đăng nhập Google account
3. Chọn **Create API key**
4. Copy API key vừa tạo

## Cách chạy ứng dụng

1. Mở file `/home/runner/work/translate/translate/lhthuan/translate/index.html` bằng trình duyệt.
2. Dán API key vào ô **Google AI API key**.
3. (Khuyên dùng) Nhập PIN vào ô **PIN mã hóa key**, nhấn **Lưu key** để lưu API key an toàn.
4. Khi mở lại ứng dụng, nhập PIN rồi nhấn **Mở khóa key đã lưu**.
5. Nhập văn bản cần dịch, chọn ngôn ngữ đích.
6. Nhấn **Dịch** để nhận kết quả.
7. Nhấn **Sao chép kết quả** để copy nhanh.

## Lưu ý

- API key được mã hóa trước khi lưu trong Local Storage.
- Không chia sẻ API key và PIN với người khác.
