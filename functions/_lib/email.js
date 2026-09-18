import { WorkerMailer } from "worker-mailer";

export async function sendEmail(env, { to, subject, html }) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.warn("SMTP_HOST/SMTP_USER/SMTP_PASS not set — skipping email send:", subject, "to", to);
    return { skipped: true };
  }

  const port = Number(env.SMTP_PORT || 587);
  const fromEmail = env.EMAIL_FROM || env.SMTP_USER;

  try {
    const mailer = await WorkerMailer.connect({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      credentials: { username: env.SMTP_USER, password: env.SMTP_PASS },
      authType: ["plain", "login"],
    });

    await mailer.send({
      from: { name: env.EMAIL_FROM_NAME || "HANDYPAD", email: fromEmail },
      to,
      subject,
      html,
    });

    return { success: true };
  } catch (err) {
    console.error("SMTP error:", err.message);
    return { success: false, error: err.message };
  }
}

const PAYMENT_METHOD_LABELS = {
  bank: "Chuyển khoản ngân hàng",
  zalopay: "ZaloPay",
  card: "Thẻ quốc tế (Stripe)",
};

const vnd = (n) => `${Number(n || 0).toLocaleString("vi-VN")} ₫`;

const orderDateLabel = (order) => {
  try {
    return new Date(order.created_at).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return order.created_at || "";
  }
};

function computeOrderView(order) {
  let items = [];
  try {
    items = JSON.parse(order.items_json || "[]");
  } catch {
    items = [];
  }

  const subtotal = order.order_total_vnd ?? items.reduce((sum, i) => sum + (i.lineTotal || 0), 0);
  const totalAmount = subtotal;
  const amountPaid = Number(order.amount) || 0;
  const amountRemaining = Math.max(0, totalAmount - amountPaid);

  return {
    items,
    subtotal,
    totalAmount,
    amountPaid,
    amountRemaining,
    isDeposit: order.payment_type === "deposit",
    paymentStatusLabel: order.payment_type === "deposit" ? "Đã đặt cọc" : "Đã thanh toán",
    paymentMethodLabel: PAYMENT_METHOD_LABELS[order.method] || order.method,
    orderDate: orderDateLabel(order),
  };
}

function itemsTableHtml(items) {
  if (!items.length) return "";
  const rows = items
    .map(
      (i) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${i.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${i.variant || "-"}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${vnd(i.unitPrice)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${vnd(i.lineTotal)}</td>
        </tr>`
    )
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px">
      <thead>
        <tr style="background:#f7f7f7;text-align:left">
          <th style="padding:8px">Sản phẩm</th>
          <th style="padding:8px">Phân loại</th>
          <th style="padding:8px;text-align:center">SL</th>
          <th style="padding:8px;text-align:right">Đơn giá</th>
          <th style="padding:8px;text-align:right">Thành tiền</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function orderSummaryHtml(order, view) {
  return `
    <h4 style="margin:20px 0 8px">Thông tin đơn hàng</h4>
    <p style="margin:2px 0"><b>Mã đơn:</b> ${order.id}</p>
    <p style="margin:2px 0"><b>Ngày đặt:</b> ${view.orderDate}</p>
    <p style="margin:2px 0"><b>Trạng thái thanh toán:</b> ${view.paymentStatusLabel}</p>
    <p style="margin:2px 0"><b>Phương thức:</b> ${view.paymentMethodLabel}</p>
    ${itemsTableHtml(view.items)}
    <p style="margin:2px 0">Tổng giá trị sản phẩm: <b>${vnd(view.subtotal)}</b></p>
    <p style="margin:2px 0;color:#666">Phí giao hàng: liên hệ để được thông báo (nếu có)</p>
    <p style="margin:2px 0">Tổng cần thanh toán: <b>${vnd(view.totalAmount)}</b></p>
    <p style="margin:2px 0">Số tiền đã thanh toán: <b>${vnd(view.amountPaid)}</b></p>
    ${view.isDeposit ? `<p style="margin:2px 0">Số tiền còn lại: <b>${vnd(view.amountRemaining)}</b></p>` : ""}`;
}

function shippingHtml(order, { recipientLabel = "Người nhận" } = {}) {
  return `
    <h4 style="margin:20px 0 8px">Giao hàng</h4>
    <p style="margin:2px 0"><b>${recipientLabel}:</b> ${order.customer_name || "-"}</p>
    <p style="margin:2px 0"><b>Điện thoại:</b> ${order.customer_phone || "-"}</p>
    <p style="margin:2px 0"><b>Email:</b> ${order.customer_email || "-"}</p>
    <p style="margin:2px 0"><b>Địa chỉ:</b> ${[order.shipping_address, order.shipping_city, order.shipping_country].filter(Boolean).join(", ") || "-"}</p>`;
}

export function customerEmailHtml(order) {
  const view = computeOrderView(order);
  return `
    <div style="font-family:sans-serif;line-height:1.5;color:#222;max-width:640px">
      <h2 style="margin-bottom:0">Cảm ơn bạn đã thanh toán!</h2>
      <p>Xin chào ${order.customer_name || "bạn"},</p>
      <p>Chúng tôi đã nhận được thanh toán cho đơn hàng <b>#${order.id}</b> của bạn.
      Đơn hàng hiện đang được xử lý. Đội ngũ DLV Corporation sẽ liên hệ nếu cần xác nhận
      thêm thông tin liên quan đến giao hàng.</p>

      ${orderSummaryHtml(order, view)}
      <p>Đội ngũ sale của chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.</p>

      ${shippingHtml(order)}

      <p style="margin-top:24px">Nếu bạn cần thay đổi thông tin đơn hàng hoặc cần hỗ trợ, vui lòng liên hệ:</p>
      <p style="margin:2px 0">Email: sales@dlvcorp.com</p>
      <p style="margin:2px 0">Điện thoại / Zalo / WhatsApp: +84 347 099 905</p>

      <p style="margin-top:24px">Trân trọng,<br/>Online Sales Team<br/>DLV Corporation</p>
    </div>`;
}

export function salesEmailHtml(order) {
  const view = computeOrderView(order);
  return `
    <div style="font-family:sans-serif;line-height:1.5;color:#222;max-width:640px">
      <h2 style="margin-bottom:0">Đơn hàng HANDYPAD mới đã thanh toán</h2>
      <p>Một khách hàng vừa hoàn tất thanh toán trên website HANDYPAD.</p>

      <h4 style="margin:20px 0 8px">Thông tin khách hàng</h4>
      <p style="margin:2px 0"><b>Tên:</b> ${order.customer_name || "-"}</p>
      <p style="margin:2px 0"><b>Công ty:</b> ${order.company_name || "-"}</p>
      <p style="margin:2px 0"><b>Email:</b> ${order.customer_email || "-"}</p>
      <p style="margin:2px 0"><b>Điện thoại:</b> ${order.customer_phone || "-"}</p>
      <p style="margin:2px 0"><b>Nguồn:</b> handypad.handyman.vn</p>

      ${orderSummaryHtml(order, view)}
      ${shippingHtml(order, { recipientLabel: "Người nhận" })}

      <p style="margin-top:20px"><b>Action:</b> Vui lòng kiểm tra đơn hàng trên Odoo và liên hệ khách nếu cần xác nhận thêm thông tin giao hàng.</p>
      ${
        order.odoo_order_url
          ? `<p><a href="${order.odoo_order_url}" style="display:inline-block;padding:10px 18px;background:#e8622c;color:#fff;text-decoration:none;border-radius:4px">Xem đơn hàng trong Odoo</a></p>`
          : ""
      }

      <p style="margin-top:24px;color:#888;font-size:12px">Email được tạo tự động từ hệ thống HANDYPAD. Không cần trả lời email này.</p>
    </div>`;
}
