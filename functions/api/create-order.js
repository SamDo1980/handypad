import { createZaloPayOrder } from "../_lib/zalopay.js";

function genOrderId() {
  return `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { method, amount, customerName, customerEmail, customerPhone, note } = body;

    if (!method || !amount || Number(amount) <= 0) {
      return Response.json({ error: "Thiếu method hoặc amount không hợp lệ" }, { status: 400 });
    }

    const orderId = genOrderId();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO orders (id, method, amount, status, customer_name, customer_email, customer_phone, note, provider_trans_id, created_at, updated_at)
       VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, NULL, ?, ?)`
    )
      .bind(orderId, method, amount, customerName || null, customerEmail || null, customerPhone || null, note || null, now, now)
      .run();

    let result = { orderId };

    if (method === "bank") {
      const vietQrUrl = `https://img.vietqr.io/image/${env.BANK_BIN}-${env.BANK_ACCOUNT}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(orderId)}&accountName=${encodeURIComponent(env.BANK_ACCOUNT_NAME || "")}`;
      result = {
        ...result,
        type: "bank",
        qrImageUrl: vietQrUrl,
        bankAccount: env.BANK_ACCOUNT,
        bankAccountName: env.BANK_ACCOUNT_NAME,
        bankName: env.BANK_NAME,
        transferContent: orderId,
      };
    } else if (method === "zalopay") {
      const zp = await createZaloPayOrder(env, { orderId, amount, description: note });
      await env.DB.prepare(`UPDATE orders SET provider_trans_id = ? WHERE id = ?`)
        .bind(zp.appTransId, orderId)
        .run();
      result = { ...result, type: "redirect", payUrl: zp.raw.order_url, raw: zp.raw };
    } else if (method === "card") {
      result = { ...result, type: "card" };
    } else {
      return Response.json({ error: "Phương thức không hỗ trợ" }, { status: 400 });
    }

    return Response.json(result);
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message || "Lỗi tạo đơn hàng" }, { status: 500 });
  }
}
