import { sendEmail, customerEmailHtml, salesEmailHtml } from "./email.js";
import { appendOrderToSheet } from "./google-sheets.js";
import { createOdooLead } from "./odoo.js";

export async function handlePaymentSuccess(env, order) {
  const tasks = [];

  if (order.customer_email) {
    tasks.push(
      sendEmail(env, {
        to: order.customer_email,
        subject: "Xác nhận thanh toán thành công",
        html: customerEmailHtml(order),
      })
    );
  }

  tasks.push(
    sendEmail(env, {
      to: env.SALES_EMAIL,
      subject: `[Đơn mới] ${order.id} đã thanh toán qua ${order.method}`,
      html: salesEmailHtml(order),
    })
  );

  if (env.GOOGLE_SHEET_ID) {
    tasks.push(
      appendOrderToSheet(env, order).catch((err) =>
        console.error("Google Sheets lỗi:", err.message)
      )
    );
  }

  if (env.ODOO_URL) {
    tasks.push(
      createOdooLead(env, order).catch((err) =>
        console.error("Odoo CRM lỗi:", err.message)
      )
    );
  }

  await Promise.all(tasks);
}
