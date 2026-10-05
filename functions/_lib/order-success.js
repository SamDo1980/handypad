import { runAfterPaid, odooSaleOrderStep, googleSheetStep } from "../../payment-kit/server/after-paid/index.js";

function parseItems(order) {
  try {
    const items = JSON.parse(order.items_json || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export const handlePaymentSuccess = runAfterPaid([
  odooSaleOrderStep({
    toSaleOrder: (order) => ({
      reference: order.id,
      origin: `Website HANDYPAD ${order.id}`,
      note: order.vat_invoice ? `Yêu cầu xuất hoá đơn VAT — Công ty: ${order.company_name || ""} — MST: ${order.tax_code || ""}` : "",
      customer: {
        name: order.customer_name || order.customer_email || `Khách hàng ${order.id}`,
        email: order.customer_email,
        phone: order.customer_phone,
        company: order.company_name,
        street: order.shipping_address,
        city: order.shipping_city,
        country: order.shipping_country,
      },
      lines: parseItems(order).map((item) => ({
        sku: item.sku,
        productName: `${item.name} (${item.variant})`,
        description: `${item.name} — ${item.variant}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    }),
  }),

  googleSheetStep({
    toPayload: (order) => ({
      orderId: order.id,
      method: order.method,
      paymentType: "Thanh toán đầy đủ",
      amount: order.order_total_vnd ?? order.amount,
      amountUsd: order.currency === "USD" ? order.amount : "",
      fxRate: "",
      status: order.status,
      customerName: order.customer_name || "",
      customerEmail: order.customer_email || "",
      customerPhone: order.customer_phone || "",
    }),
  }),
]);
