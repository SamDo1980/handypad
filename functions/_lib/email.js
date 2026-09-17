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

export function customerEmailHtml(order) {
  return `
    <div style="font-family:sans-serif;line-height:1.5">
      <h2>Cảm ơn bạn đã thanh toán!</h2>
      <p>Đơn hàng <b>#${order.id}</b> đã được thanh toán/đặt cọc thành công.</p>
      <ul>
        <li>Loại thanh toán: ${order.payment_type === "deposit" ? "Đặt cọc" : "Thanh toán đầy đủ"}</li>
        <li>Số tiền: <b>${Number(order.amount).toLocaleString("vi-VN")}đ</b></li>
        <li>Phương thức: ${order.method}</li>
      </ul>
      <p>Đội ngũ sale của chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.</p>
    </div>`;
}

export function salesEmailHtml(order) {
  return `
    <div style="font-family:sans-serif;line-height:1.5">
      <h2>Khách hàng mới đã thanh toán</h2>
      <ul>
        <li>Mã đơn: <b>${order.id}</b></li>
        <li>Khách hàng: ${order.customer_name || "(chưa có tên)"}</li>
        <li>Email: ${order.customer_email || "-"}</li>
        <li>SĐT: ${order.customer_phone || "-"}</li>
        <li>Loại thanh toán: ${order.payment_type === "deposit" ? "Đặt cọc" : "Thanh toán đầy đủ"}</li>
        <li>Số tiền: <b>${Number(order.amount).toLocaleString("vi-VN")}đ</b></li>
        <li>Phương thức: ${order.method}</li>
      </ul>
      <p>Vui lòng liên hệ khách để chăm sóc/chốt đơn.</p>
    </div>`;
}
