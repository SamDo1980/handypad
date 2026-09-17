async function odooCall(env, service, method, args) {
  const res = await fetch(`${env.ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Date.now(),
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`Odoo lỗi: ${data.error.data?.message || JSON.stringify(data.error)}`);
  }
  return data.result;
}

async function odooLogin(env) {
  const uid = await odooCall(env, "common", "login", [
    env.ODOO_DB,
    env.ODOO_USERNAME,
    env.ODOO_API_KEY,
  ]);
  if (!uid) throw new Error("Odoo login thất bại — kiểm tra ODOO_DB/USERNAME/API_KEY");
  return uid;
}

export async function createOdooLead(env, order) {
  const uid = await odooLogin(env);

  const leadId = await odooCall(env, "object", "execute_kw", [
    env.ODOO_DB,
    uid,
    env.ODOO_API_KEY,
    "crm.lead",
    "create",
    [
      {
        name: `Đơn hàng ${order.id} (${order.method}${order.payment_type === "deposit" ? " — đặt cọc" : " — thanh toán đủ"})`,
        contact_name: order.customer_name || "",
        email_from: order.customer_email || "",
        phone: order.customer_phone || "",
        description: order.note || "",
        expected_revenue: Number(order.amount),
        type: "opportunity",
      },
    ],
  ]);

  return leadId;
}
