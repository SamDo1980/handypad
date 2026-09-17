import { createZaloPayOrder } from "../_lib/zalopay.js";
import { nextOrderId } from "../_lib/order-id.js";
import { getUsdToVndRate } from "../_lib/fx.js";
import { resolveOrderItems } from "../_lib/catalog.js";

const DEPOSIT_USD = 5;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { method, customerName, customerEmail, customerPhone } = body;
    const paymentType = body.paymentType === "deposit" ? "deposit" : "full";
    const company = body.company || body.customer?.company || null;
    const shipping = body.shipping || {};

    // Product lines + subtotal are always resolved server-side from our own
    // catalog (never trusted from the client) — see catalog.js.
    const { items: resolvedItems, subtotal } = resolveOrderItems(body.items);
    if (!resolvedItems.length) {
      return Response.json({ error: "Giỏ hàng trống hoặc sản phẩm không hợp lệ" }, { status: 400 });
    }

    // The deposit is a fixed $5.00 — always computed here from a live FX
    // rate (never trusted from the client) so it can't be tampered with and
    // always reflects the rate at the moment the order is created.
    // A full payment charges the server-computed subtotal above.
    let amount;
    let amountUsd = null;
    let fxRate = null;

    if (paymentType === "deposit") {
      fxRate = await getUsdToVndRate(env);
      amountUsd = DEPOSIT_USD;
      amount = Math.max(1, Math.round(DEPOSIT_USD * fxRate));
    } else {
      amount = subtotal;
    }

    if (!method || !amount || Number(amount) <= 0) {
      return Response.json({ error: "Thiếu method hoặc amount không hợp lệ" }, { status: 400 });
    }

    const orderId = await nextOrderId(env, paymentType);
    const now = new Date().toISOString();
    const note = resolvedItems.map((i) => `${i.quantity}x ${i.name} (${i.variant})`).join("; ");

    await env.DB.prepare(
      `INSERT INTO orders (
         id, method, payment_type, amount, amount_usd, fx_rate, order_total_vnd,
         status, customer_name, customer_email, customer_phone, company_name,
         shipping_address, shipping_city, shipping_country, items_json, note,
         provider_trans_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    )
      .bind(
        orderId,
        method,
        paymentType,
        amount,
        amountUsd,
        fxRate,
        subtotal,
        customerName || null,
        customerEmail || null,
        customerPhone || null,
        company,
        shipping.address || null,
        shipping.city || null,
        shipping.country || null,
        JSON.stringify(resolvedItems),
        note,
        now,
        now
      )
      .run();

    let result = { orderId, paymentType, amount };

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
