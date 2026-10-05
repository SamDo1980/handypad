export { odooSaleOrderStep } from "./odoo.js";
export { googleSheetStep } from "./google-sheets.js";

export function runAfterPaid(steps) {
  return async (env, order) => {
    await Promise.all(
      steps
        .filter((step) => !step.enabled || step.enabled(env))
        .map(async (step) => {
          try {
            await step.run(env, order);
          } catch (err) {
            console.error(`Sau thanh toán — bước "${step.name}" lỗi (${order.id}):`, err?.message || err);
          }
        })
    );
  };
}
