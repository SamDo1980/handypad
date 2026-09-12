# handypad-landing = V70 giao diện + thanh toán thật (đã merge)

Đây là kết quả gộp giữa:
- **handypad-V70** — giao diện/UX mới nhất (bố cục, add-on, chọn "trả đủ / đặt cọc", nhiều
  cải tiến CSS/JS từ v51 đến v70).
- **handypad-landing** (bản cũ) — phần thanh toán **thật**: Stripe Elements (thẻ), ZaloPay
  (popup sandbox thật), VietQR + SePay webhook (chuyển khoản), backend Cloudflare Pages
  Functions + D1.

Kết quả: giao diện y hệt V70, nhưng khi bấm thanh toán thì tiền đi qua backend thật, không
còn form giả nữa.

## Nguyên tắc merge

V70 vốn đã tự chừa sẵn các "điểm móc" cho backend (rất may mắn, không cần đục khoét sâu):
- `window.HandyPadPaymentUI.getPayload()` / `.markSuccess(method, data)` — API công khai để
  báo cho giao diện biết khi nào đã thu tiền thành công.
- Các sự kiện tuỳ chỉnh trên `#configure-order`: `handypad:payment-option-change`,
  `handypad:payment-method-change`, `handypad:payment-success`.
- Các khối `<div data-backend-qr-slot="zalopay">` / `data-backend-qr-slot="bank_transfer">` —
  chỗ trống chờ backend nhét QR thật vào.

Toàn bộ phần nối backend nằm gọn trong **1 file mới**:
`assets/js/handypad-backend-payment.js`. File `assets/js/configure-order-v64.js` (logic gốc
của V70) hầu như không bị đụng vào — chỉ thêm vài dòng dịch (EN/VI) cho các chữ mới
(nút ZaloPay, ghi chú đang xử lý...), xem diff trong lịch sử làm việc.

Riêng nút "PAY" ở panel Thẻ: V70 gắn sẵn 1 listener giả (chỉ cần bấm là coi như thành công,
không cần nhập gì) — vì input thẻ thô đã bị gỡ khỏi HTML nên listener giả này sẽ luôn tưởng
form hợp lệ. `handypad-backend-payment.js` gỡ bỏ đúng 1 listener đó (bằng cách
clone/replace node nút) rồi gắn logic Stripe thật vào.

## Những gì đã thay đổi so với V70 gốc

1. Panel **Thẻ**: 3 ô nhập thô → 3 mount point Stripe Elements
   (`#order-card-number-element`, `#order-card-expiry-element`, `#order-card-cvc-element`),
   thêm dòng lỗi `#order-card-errors` và ghi chú bảo mật Stripe.
2. Panel **ZaloPay**: thêm nút "OPEN ZALOPAY" / "REOPEN..." + dòng trạng thái.
3. Panel **Chuyển khoản**: gắn id động cho tên/số tài khoản/ngân hàng/nội dung chuyển khoản
   (được điền từ dữ liệu backend trả về, không còn hardcode cứng trong HTML).
4. Thêm `<script src="https://js.stripe.com/v3/">`, `window.STRIPE_PUBLISHABLE_KEY` (đang là
   **test key** lấy nguyên từ bản landing cũ) và `assets/js/handypad-backend-payment.js`.
5. Thêm khối CSS `.stripe-field` để ô Stripe Elements có giao diện khớp với các ô input khác
   của V70.
6. Copy nguyên xi các file backend từ landing cũ: `functions/`, `schema.sql`,
   `wrangler.toml`, `package.json`, `apps-script-webhook.gs`.

## Khác biệt về số tiền thanh toán (quan trọng)

- V70 có 2 lựa chọn: **"Trả đủ"** (full — đúng bằng tổng đơn hàng, tính bằng VND thật) và
  **"Đặt cọc"** (deposit — cố định $5).
- Vì backend chỉ nhận VND, khi khách chọn "Đặt cọc", số tiền gửi lên backend là hằng số
  `HANDYPAD_DEPOSIT_VND = 125000` trong `assets/js/handypad-backend-payment.js` — **đây vẫn
  là con số tạm/ước tính ~25.000 VND/USD, y hệt cảnh báo TODO trong bản landing cũ**, bạn cần
  xác nhận số VND chính xác muốn thu.
- Khi chọn "Trả đủ", số tiền gửi lên backend = tổng đơn hàng VND thật (`orderTotalVnd`) —
  không cần cấu hình gì thêm.

## Việc cần làm trước khi deploy (giống hệt bản landing cũ, chưa đổi)

Xem chi tiết đầy đủ trong `README-payment-backend.md` (giữ nguyên từ bản landing cũ). Tóm tắt:

1. Xác nhận `HANDYPAD_DEPOSIT_VND` (VND thật cho "Đặt cọc").
2. Kiểm tra lại thông tin ngân hàng trong `wrangler.toml`
   (`BANK_ACCOUNT`, `BANK_ACCOUNT_NAME`, `BANK_NAME`, `BANK_BIN`).
3. Thay `window.STRIPE_PUBLISHABLE_KEY` trong `index.html` bằng key thật (đang là test key).
4. Set các secret qua `wrangler pages secret put`: `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2`,
   `SEPAY_API_KEY`, `RESEND_API_KEY`, (tuỳ chọn) `ODOO_API_KEY`.
5. Tạo D1 database + chạy `schema.sql`.
6. Trỏ webhook ZaloPay/Stripe/SePay về `/api/webhook/{zalopay,stripe,sepay}`.

## Test cục bộ

```bash
npm install -g wrangler
wrangler pages dev . --d1 DB=handypad_orders_db
```
Mở trang, cuộn tới "CONFIGURE & ORDER", thêm sản phẩm, điền thông tin liên hệ, thử cả 3
phương thức thanh toán. Thẻ test: `4242 4242 4242 4242`, ngày hết hạn bất kỳ trong tương lai,
CVC 3 số bất kỳ.

## Lưu ý / rủi ro còn lại

- Mình **chưa chạy thử thực tế bằng `wrangler pages dev`** trong môi trường này (không có
  mạng để cài wrangler / gọi Stripe-ZaloPay-SePay sandbox thật), nên trước khi deploy production
  bạn **nên tự test đầy đủ cả 3 luồng thanh toán** (thẻ, ZaloPay, chuyển khoản) ở local hoặc
  staging.
- Đã kiểm tra: cú pháp JS hợp lệ (`node --check`), HTML cân bằng thẻ, không id trùng lặp,
  và đã diff so với bản gốc V70 để đảm bảo không có thay đổi ngoài ý muốn ở phần giao diện.
