import { sendEmail, customerEmailHtml, salesEmailHtml } from "./email.js";
import { appendOrderToSheet } from "./google-sheets.js";
import { createOdooLead } from "./odoo.js";

export async function handlePaymentSuccess(env, order) {
  // Create the Odoo lead FIRST (awaited) so its record id is available to
  // build a real "view in Odoo" link for the sales email below. Everything
  // else (emails, sheet) then runs in parallel.
  let odooOrderUrl = null;
  if (env.ODOO_URL) {
    try {
      const leadId = await createOdooLead(env, order);
      if (leadId) {
        odooOrderUrl = `${env.ODOO_URL}/web#id=${leadId}&model=crm.lead&view_type=form`;
      }
    } catch (err) {
      console.error("Odoo CRM lỗi:", err.message);
    }
  }

  const enrichedOrder = { ...order, odoo_order_url: odooOrderUrl };
  const tasks = [];

  if (order.customer_email) {
    tasks.push(
      sendEmail(env, {
        to: order.customer_email,
        subject: `Xác nhận thanh toán thành công HANDYPAD #${order.id} – Thanh toán thành công`,
        html: customerEmailHtml(enrichedOrder),
      })
    );
  }

  tasks.push(
    sendEmail(env, {
      to: env.SALES_EMAIL,
      subject: salesEmailSubject(enrichedOrder),
      html: salesEmailHtml(enrichedOrder),
    })
  );

  if (env.GOOGLE_SHEETS_WEBHOOK_URL) {
    tasks.push(
      appendOrderToSheet(env, order).catch((err) =>
        console.error("Google Sheets lỗi:", err.message)
      )
    );
  }

  await Promise.all(tasks);
}

function salesEmailSubject(order) {
  const prefix = order.payment_type === "deposit" ? "DPS" : "ORD";
  const total = Number(order.order_total_vnd ?? order.amount).toLocaleString("vi-VN") + " ₫";
  const customerName = order.customer_name || "(chưa có tên)";
  return `[HANDYPAD] [${prefix}] ${order.id} – ${customerName} – ${total}`;
}
