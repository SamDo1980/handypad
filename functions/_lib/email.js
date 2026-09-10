export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email send:", subject, "to", to);
    return { skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || "no-reply@yourdomain.com",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Resend error:", res.status, text);
  }
  return res.json().catch(() => ({}));
}

export function customerEmailHtml(order) {
  return `
    <div style="font-family:sans-serif;line-height:1.5">
      <h2>Cảm ơn bạn đã thanh toán!</h2>
      <p>Đơn hàng <b>#${order.id}</b> đã được thanh toán/đặt cọc thành công.</p>
      <ul>
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
        <li>Số tiền: <b>${Number(order.amount).toLocaleString("vi-VN")}đ</b></li>
        <li>Phương thức: ${order.method}</li>
      </ul>
      <p>Vui lòng liên hệ khách để chăm sóc/chốt đơn.</p>
    </div>`;
}
