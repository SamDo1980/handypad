import { createPaymentKit, PaymentError, zalopayProvider, paypalProvider } from "../../payment-kit/server/index.js";
import { resolveOrderItems } from "./catalog.js";
import { nextOrderId } from "./order-id.js";
import { handlePaymentSuccess } from "./order-success.js";

export const payments = createPaymentKit({
  providers: { zalopay: zalopayProvider(), paypal: paypalProvider() },
  returnPath: "/#order-payment",
  returnPagePath: "/api/payment-return",
  nextOrderId,
  onPaid: handlePaymentSuccess,

  prepareOrder(body) {
    const shipping = body.shipping || {};

    const { items, subtotal, subtotalUsd } = resolveOrderItems(body.items);
    if (!items.length) throw new PaymentError("Giỏ hàng trống hoặc sản phẩm không hợp lệ");

    const note = items.map((i) => `${i.quantity}x ${i.name} (${i.variant})`).join("; ");
    return {
      amounts: { VND: subtotal, USD: subtotalUsd },
      description: note,
      columns: {
        payment_type: "full",
        order_total_vnd: subtotal,
        customer_name: body.customerName || null,
        customer_email: body.customerEmail || null,
        customer_phone: body.customerPhone || null,
        company_name: body.company || null,
        tax_code: body.vatInvoice ? body.taxCode || null : null,
        vat_invoice: body.vatInvoice ? 1 : 0,
        shipping_address: shipping.address || null,
        shipping_city: shipping.city || null,
        shipping_country: shipping.country || null,
        items_json: JSON.stringify(items),
        note
      }
    };
  }
});