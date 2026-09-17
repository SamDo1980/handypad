export async function appendOrderToSheet(env, order) {
  if (!env.GOOGLE_SHEETS_WEBHOOK_URL) return;

  const res = await fetch(env.GOOGLE_SHEETS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: order.id,
      method: order.method,
      paymentType: order.payment_type === "deposit" ? "Đặt cọc" : "Thanh toán đầy đủ",
      amount: order.amount,
      amountUsd: order.amount_usd ?? "",
      fxRate: order.fx_rate ?? "",
      status: order.status,
      customerName: order.customer_name || "",
      customerEmail: order.customer_email || "",
      customerPhone: order.customer_phone || ""
    }),
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Google Sheets webhook lỗi: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
