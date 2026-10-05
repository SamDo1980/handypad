# Hướng dẫn kết nối payment (payment-kit)

`payment-kit/` là phần thanh toán đã tách khỏi project HANDYPAD để dùng lại cho
project khác. Gồm hai phần:

- **Thu tiền**: **ZaloPay** (thu VND) và **PayPal** (thu USD).
- **Sau khi thanh toán thành công**: tạo Sales Order trên **Odoo** (Odoo tự gửi
  email xác nhận cho khách) và ghi một dòng vào **Google Sheets**.

Kit chạy trên **Cloudflare Pages Functions + D1**. Nó không biết gì về sản phẩm,
giá hay mã đơn của project — project chỉ khai báo cách tính giá và cách ánh xạ
dữ liệu đơn hàng sang Odoo / Sheets.

```
payment-kit/
  README.md                 tài liệu này
  schema.sql                bảng orders tối thiểu
  server/
    index.js                createPaymentKit() — tạo đơn, trạng thái đơn, webhook
    orders.js               đọc/ghi bảng orders (D1)
    errors.js               PaymentError
    hmac.js                 HMAC-SHA256
    providers/zalopay.js    cổng ZaloPay
    providers/paypal.js     cổng PayPal
    after-paid/
      index.js              runAfterPaid() — chạy các bước sau thanh toán
      odoo.js               bước Odoo: khách hàng, sản phẩm, Sales Order, email
      google-sheets.js      bước Google Sheets
      google-sheets-apps-script.gs   script dán vào Google Sheet
  client/
    payment-client.js       gọi API từ trình duyệt (không chứa secret)
```

## 1. Luồng hoạt động

```
Trình duyệt                      Server (Functions)                 Cổng thanh toán
POST /api/create-order  ───────► tính giá phía server, lưu đơn
                                 PENDING, tạo giao dịch ──────────► ZaloPay / PayPal
        ◄─────── { orderId, payUrl }
mở payUrl ở cửa sổ mới ──────────────────────────────────────────► khách trả tiền
                                 webhook / return (đã xác thực) ◄── báo kết quả
                                 kiểm tra số tiền → đơn = PAID
                                 → chạy onPaid() đúng 1 lần:
                                   Odoo Sales Order + email, Google Sheet
GET /api/order-status/:id (4 giây/lần) ◄── PAID → hiện "đã thanh toán"
```

Ba nguyên tắc kit đã lo sẵn, không cần làm lại:

- Giá do server tính (`prepareOrder`), không lấy số tiền từ trình duyệt.
- Đơn chỉ thành `PAID` khi cổng thanh toán báo về và đã xác thực (chữ ký ZaloPay,
  hoặc hỏi lại API PayPal), đồng thời số tiền + loại tiền khớp với đơn.
- `onPaid` chỉ chạy một lần cho mỗi đơn, kể cả khi cổng gọi webhook nhiều lần.

## 2. Kết nối vào project mới

### Bước 1 — Copy thư mục

Copy nguyên `payment-kit/` vào thư mục gốc của project (ngang hàng `functions/`).

### Bước 2 — Tạo bảng D1

```bash
wrangler d1 create ten-database
```

```bash
wrangler d1 execute ten-database --remote --file=./payment-kit/schema.sql
```

Khai báo binding tên **`DB`** trong `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ten-database"
database_id = "..."
```

Cần lưu thêm thông tin (khách hàng, địa chỉ, giỏ hàng...) thì thêm cột vào bảng
`orders` và trả chúng về trong `columns` ở bước 3.

### Bước 3 — Khai báo kit cho project

Tạo `functions/_lib/payments.js`. Đây là file duy nhất chứa logic riêng của project
(bản của HANDYPAD: [functions/_lib/payments.js](../functions/_lib/payments.js)).

```js
import { createPaymentKit, PaymentError, zalopayProvider, paypalProvider } from "../../payment-kit/server/index.js";
import { afterPaid } from "./order-success.js"; // bước 4

export const payments = createPaymentKit({
  // Bật cổng nào thì khai báo cổng đó.
  providers: { zalopay: zalopayProvider(), paypal: paypalProvider() },

  // Trang khách quay về sau khi rời cổng thanh toán.
  returnPath: "/#order-payment",

  // Sinh mã đơn, ví dụ "ORD000001".
  nextOrderId: async (env) => `ORD${Date.now()}`,

  // body = JSON trình duyệt gửi lên. Tính giá Ở ĐÂY, từ dữ liệu của server.
  async prepareOrder(body, env) {
    const total = tinhTongTien(body.items); // { vnd, usd }
    if (!total) throw new PaymentError("Giỏ hàng không hợp lệ");
    return {
      amounts: { VND: total.vnd, USD: total.usd }, // mỗi cổng lấy đúng loại tiền của nó
      description: "Mo ta don hang",
      columns: { customer_email: body.customerEmail || null }, // cột thêm của bảng orders
    };
  },

  // Chạy 1 lần sau khi đơn PAID — xem bước 4.
  onPaid: afterPaid,
});
```

Chỉ dùng ZaloPay thì `amounts` chỉ cần `VND`; chỉ dùng PayPal thì chỉ cần `USD`.

### Bước 4 — Khai báo các bước sau thanh toán

`onPaid` nhận `order` là nguyên dòng trong bảng `orders` (gồm cả các cột thêm ở
bước 3). Dùng các bước có sẵn của kit, project chỉ viết phần ánh xạ dữ liệu
(bản của HANDYPAD: [functions/_lib/order-success.js](../functions/_lib/order-success.js)).

```js
import { runAfterPaid, odooSaleOrderStep, googleSheetStep } from "../../payment-kit/server/after-paid/index.js";

export const afterPaid = runAfterPaid([
  odooSaleOrderStep({
    toSaleOrder: (order) => ({
      reference: order.id,                    // "Customer Reference" trên Sales Order
      origin: `Website ${order.id}`,          // "Source Document"
      note: "",                             // (tuỳ chọn) ghi chú hiện trên Sales Order
      customer: {
        name: order.customer_name, email: order.customer_email, phone: order.customer_phone,
        company: order.company_name, street: order.shipping_address,
        city: order.shipping_city, country: order.shipping_country,
      },
      lines: JSON.parse(order.items_json).map((item) => ({
        sku: item.sku,                        // khớp "Internal Reference" của sản phẩm Odoo
        productName: item.name,               // tên dùng khi phải tạo sản phẩm mới
        description: item.name,               // mô tả dòng trên Sales Order
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    }),
  }),

  googleSheetStep({
    toPayload: (order) => ({ row: [order.id, order.method, order.amount, order.currency, order.customer_email] }),
  }),
]);
```

**Bước Odoo** làm lần lượt:

1. Tìm khách hàng theo email; chưa có thì tạo contact kèm địa chỉ.
2. Tìm từng sản phẩm theo *Internal Reference* = `sku`; chưa có thì tạo mới một lần.
3. Tạo Sales Order và xác nhận (confirm).
4. Gửi email đơn hàng cho khách **từ Odoo** (giống nút "Send by Email", dùng
   template của Odoo, có lưu trong chatter).

Dừng ở đó: đối soát thanh toán và xuất hoá đơn do kế toán làm trên Odoo. Tắt bớt
bằng tuỳ chọn: `odooSaleOrderStep({ toSaleOrder, confirm: false, sendEmail: false })`.
Thuế: Odoo áp thuế mặc định của sản phẩm — nếu giá website đã gồm VAT thì đặt thuế
sản phẩm tương ứng để tổng Sales Order khớp số tiền khách trả.

**Bước Google Sheets**: mở Sheet đích → *Extensions > Apps Script* → dán nội dung
`server/after-paid/google-sheets-apps-script.gs` → *Deploy > New deployment > Web app*
(*Execute as: Me*, *Who has access: Anyone*) → lấy URL đặt vào
`GOOGLE_SHEETS_WEBHOOK_URL`. `toPayload` trả về `{ row: [...] }`; script tự thêm
cột thời gian ở đầu dòng.

Các bước chạy song song và độc lập: Odoo lỗi thì Sheet vẫn được ghi, và đơn vẫn
`PAID` (lỗi nằm trong log của Functions). Bước nào thiếu biến môi trường
(`ODOO_URL`, `GOOGLE_SHEETS_WEBHOOK_URL`) thì tự bỏ qua.

Thêm bước riêng (gửi Telegram, gọi API khác...) chỉ cần một object:

```js
{ name: "telegram", enabled: (env) => Boolean(env.TELEGRAM_TOKEN), async run(env, order) { /* ... */ } }
```

### Bước 5 — Tạo các route (mỗi file 2 dòng)

| File | Nội dung |
| --- | --- |
| `functions/api/create-order.js` | `export const onRequestPost = payments.createOrder;` |
| `functions/api/order-status/[id].js` | `export const onRequestGet = payments.orderStatus;` |
| `functions/api/webhook/zalopay.js` | `export const onRequestPost = payments.webhook("zalopay");` |
| `functions/api/webhook/paypal.js` | `export const onRequestPost = payments.webhook("paypal");` |
| `functions/api/paypal/return.js` | `export const onRequestGet = payments.customerReturn("paypal");` |

Mỗi file thêm dòng `import { payments } from "<đường dẫn>/_lib/payments.js";` ở đầu.

Muốn đổi đường dẫn thì truyền vào provider:
`zalopayProvider({ callbackRoute: "/api/webhook/zalopay" })`,
`paypalProvider({ returnRoute: "/api/paypal/return" })`.

### Bước 6 — Biến môi trường

Biến thường đặt trong `[vars]` của `wrangler.toml`; secret đặt bằng lệnh:

```bash
wrangler pages secret put TEN_BIEN
```

| Biến | Loại | Ý nghĩa |
| --- | --- | --- |
| `SITE_URL` | var | Domain chính thức, ví dụ `https://shop.example.com`. Bỏ trống thì lấy theo domain của request. |
| `ZALOPAY_APP_ID` | secret | App ID do ZaloPay cấp |
| `ZALOPAY_KEY1` | secret | Key ký yêu cầu tạo đơn |
| `ZALOPAY_KEY2` | secret | Key xác thực callback |
| `ZALOPAY_ENDPOINT` | var | Production: `https://openapi.zalopay.vn/v2/create`. Bỏ trống = sandbox. |
| `PAYPAL_ENV` | var | `live` cho production; giá trị khác = sandbox |
| `PAYPAL_CLIENT_ID` | secret | Client ID của app PayPal |
| `PAYPAL_CLIENT_SECRET` | secret | Secret của app PayPal |
| `PAYPAL_WEBHOOK_ID` | secret | ID của webhook đã tạo (bước 7) |
| `PAYPAL_CURRENCY` | var | Mặc định `USD` (PayPal không hỗ trợ VND) |
| `PAYPAL_BRAND_NAME` | var | Tên hiển thị trên trang PayPal (tuỳ chọn) |
| `ODOO_URL` | var | Ví dụ `https://congty.odoo.com`. Bỏ trống = không chạy bước Odoo. |
| `ODOO_DB` | var | Tên database Odoo |
| `ODOO_USERNAME` | var | Email đăng nhập của user dùng cho API |
| `ODOO_API_KEY` | secret | API key của user đó (cần quyền Sales, Contacts, tạo sản phẩm) |
| `GOOGLE_SHEETS_WEBHOOK_URL` | var | URL Web app của Apps Script. Bỏ trống = không ghi Sheet. |

Nếu **không đặt** 3 biến ZaloPay, kit dùng app sandbox công khai của ZaloPay để
test ngay được. Trước khi chạy thật phải đặt đủ cả 3 biến và `ZALOPAY_ENDPOINT`.

### Bước 7 — Đăng ký với cổng thanh toán

**ZaloPay**

1. Đăng ký merchant tại ZaloPay, lấy `app_id`, `key1`, `key2`.
2. Callback: kit tự gửi `callback_url = SITE_URL + /api/webhook/zalopay` theo từng
   giao dịch, nên `SITE_URL` phải là domain public (ZaloPay không gọi được localhost).

**PayPal**

1. Vào developer.paypal.com → *Apps & Credentials* → tạo app (chọn Sandbox hoặc
   Live) → lấy *Client ID* và *Secret*.
2. Trong app đó → *Add Webhook*:
   - URL: `https://<domain>/api/webhook/paypal`
   - Events: `Checkout order approved`, `Payment capture completed`
3. Copy *Webhook ID* vừa tạo vào secret `PAYPAL_WEBHOOK_ID`.

Sandbox và Live là hai app riêng: khi lên production phải tạo lại app + webhook ở
chế độ Live và đổi cả 3 secret, cùng `PAYPAL_ENV = "live"`.

### Bước 8 — Frontend

```js
import { createPaymentClient, secureURL } from './payment-kit/client/payment-client.js';

const client = createPaymentClient({ apiBase: '/api' });

payButton.addEventListener('click', async () => {
  // Mở cửa sổ NGAY trong sự kiện click để trình duyệt không chặn popup.
  const gateway = window.open('about:blank', '_blank');
  try {
    const order = await client.createOrder({ method: 'paypal', items: cart, customerEmail });
    gateway.opener = null;
    gateway.location.href = secureURL(order.payUrl);
    waitUntilPaid(order.orderId);
  } catch (error) {
    gateway?.close(); // error.code: 'service_error' | 'invalid_response' | 'not_configured'
  }
});

function waitUntilPaid(orderId) {
  const timer = setInterval(async () => {
    try {
      const { status } = await client.getOrderStatus(orderId);
      if (status === 'PAID') { clearInterval(timer); showThankYou(orderId); }
    } catch { /* lỗi mạng không có nghĩa là thanh toán thất bại — cứ chờ tiếp */ }
  }, 4000);
}
```

`createOrder()` trả về `{ orderId, method, amount, currency, payUrl }`, trong đó
`amount`/`currency` là số tiền cổng sẽ thu. Nếu trang hiển thị giá bằng loại tiền
khác (ví dụ trang VND nhưng trả bằng PayPal) thì nên báo cho khách số tiền này.

Bản đầy đủ có modal, khôi phục khi tải lại trang: xem
[src/checkout/payment-service.js](../src/checkout/payment-service.js) và
[src/components/payment-modal.js](../src/components/payment-modal.js) của HANDYPAD.

### Bước 9 — Test rồi mới chạy thật

```bash
wrangler pages dev .
```

- ZaloPay sandbox: thanh toán bằng app ZaloPay Sandbox. Webhook không về được
  localhost, nên muốn thấy đơn chuyển `PAID` thì test trên bản deploy (preview).
- Khi test local nên để trống `ODOO_URL` và `GOOGLE_SHEETS_WEBHOOK_URL`, nếu không
  đơn thử sẽ tạo Sales Order thật, gửi email thật và ghi vào Sheet thật:
  `wrangler pages dev . --binding ODOO_URL= --binding GOOGLE_SHEETS_WEBHOOK_URL=`
- PayPal sandbox: dùng tài khoản *Personal* trong *Sandbox Accounts* để trả tiền.
  Khi `SITE_URL` bỏ trống (hoặc trỏ về localhost), PayPal đưa khách quay lại
  localhost và bước "return" vẫn chạy, nên đơn vẫn chuyển `PAID`.

Checklist trước khi chạy thật:

- [ ] `SITE_URL` đúng domain chính thức
- [ ] Đủ 3 secret ZaloPay + `ZALOPAY_ENDPOINT` production
- [ ] `PAYPAL_ENV = "live"`, 3 secret PayPal của app Live, webhook Live đã tạo
- [ ] `ODOO_API_KEY` đã đặt; Apps Script đã deploy và URL đã khai báo
- [ ] Trả thử 1 đơn nhỏ ở mỗi cổng, kiểm tra đơn `PAID`, Sales Order xuất hiện
      trên Odoo, khách nhận email, Sheet có dòng mới
- [ ] Bấm thử "huỷ" ở PayPal: đơn vẫn `PENDING`

## 3. Nối vào một project chỉ có frontend

Trường hợp hay gặp: nhận một bản frontend hoàn chỉnh (thanh toán còn ở chế độ mô
phỏng) và cần gắn backend vào. Ví dụ đã làm: `handypad-new-test-main`.

**Copy vào project** (không sửa gì bên trong `payment-kit/`):

| Thứ copy | Việc cần chỉnh |
| --- | --- |
| `payment-kit/` | không |
| `functions/api/**` (5 file route) | không |
| `functions/_lib/payments.js` | cách tính giá, các cột lưu thêm của đơn |
| `functions/_lib/order-success.js` | ánh xạ đơn → Odoo / Sheets |
| `functions/_lib/order-id.js` | tiền tố mã đơn nếu muốn |
| `schema.sql`, `wrangler.toml` | tên project, D1, các biến |

**Giá lấy thẳng từ frontend.** Nếu frontend có file dữ liệu sản phẩm là ES module
thuần (không đụng tới `window`/`document`), cho server import chính file đó thay vì
chép lại bảng giá — frontend đổi giá thì số tiền thu tự đổi theo:

```js
// functions/_lib/catalog.js
import { products } from "../../src/data/products.js";
const bySku = new Map(products.map((p) => [p.id, p]));
```

Trình duyệt chỉ gửi `sku` + `quantity`; server tra giá từ `bySku`.

**Sửa ở frontend** — chỉ ở lớp nối với backend, không đụng giao diện:

1. *Cấu hình*: bật chế độ thật, khai báo `apiBase: '/api'`, chỉ bật phương thức đã
   có backend.
2. *Lớp gọi API* (payment service): thay bằng bản gọi `payment-kit/client`
   (`createOrder`, `getOrderStatus`) và trả kết quả về đúng dạng frontend đang dùng.
3. *Tự kiểm tra trạng thái*: sau khi tạo giao dịch, gọi `getOrderStatus` 4 giây/lần
   tới khi `PAID` (frontend mô phỏng thường chỉ có nút "kiểm tra thủ công").
4. *Mở cửa sổ thanh toán ngay trong sự kiện click*, rồi mới gọi API và chuyển
   cửa sổ đó tới `payUrl`. Mở sau khi chờ API dễ bị trình duyệt chặn popup.
5. *Ẩn phương thức chưa bật* để khách không thấy lựa chọn "chưa khả dụng".

**Trường mới của frontend** (ví dụ mã số thuế, yêu cầu hoá đơn VAT): gửi lên trong
`createOrder`, lưu qua `columns` ở `prepareOrder` (thêm cột vào `orders`), rồi dùng
trong `order-success.js` — ví dụ ghi vào `note` của Sales Order.

## 4. Thêm cổng thanh toán khác

Một cổng là một object, khai báo vào `providers` là dùng được:

```js
export function myGatewayProvider() {
  return {
    // Loại tiền cổng này thu — phải có trong `amounts` của prepareOrder.
    currency: (env) => "VND",

    // Tạo giao dịch; trả về link để khách trả tiền.
    async createPayment({ env, order, siteUrl, returnUrl }) {
      // order = { id, amount, currency, description }
      return { providerTransId: "ma-giao-dich-ben-cong", payUrl: "https://..." };
    },

    // Cổng gọi về server. Xác thực chữ ký TRƯỚC, rồi mới confirmPaid.
    async handleWebhook({ request, env, confirmPaid, findOrderByProviderTransId }) {
      // ...xác thực...
      await confirmPaid(orderId, { amount, currency });
      return new Response("ok");
    },

    // (Tuỳ chọn) trình duyệt của khách quay về từ cổng.
    async handleReturn({ request, env, returnUrl, confirmPaid }) {
      return Response.redirect(returnUrl, 302);
    },
  };
}
```

`confirmPaid` từ chối nếu số tiền hoặc loại tiền không khớp với đơn đã lưu.

## 5. Lưu ý

- Không bao giờ đặt key/secret trong code frontend hay commit vào git.
- PayPal trừ phí và có thể giữ tiền (capture `PENDING`); đơn chỉ `PAID` khi capture
  `COMPLETED`.
- Hoàn tiền chưa có trong kit — thực hiện trên trang quản trị của ZaloPay/PayPal.
- PayPal chỉ hỗ trợ loại tiền có 2 chữ số thập phân trong kit này (USD, EUR, SGD...).
