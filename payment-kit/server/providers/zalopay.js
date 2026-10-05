import { hmacSha256Hex, timingSafeEqual } from "../hmac.js";
import { PaymentError } from "../errors.js";

const SANDBOX = {
  endpoint: "https://sb-openapi.zalopay.vn/v2/create",
  appId: "2553",
  key1: "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL",
  key2: "kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz"
};

function vietnamDatePrefix() {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const yy = String(d.getUTCFullYear()).slice(2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export function zalopayProvider({ callbackRoute = "/api/webhook/zalopay" } = {}) {
  return {
    currency: () => "VND",

    async createPayment({ env, order, siteUrl, returnUrl }) {
      const appId = env.ZALOPAY_APP_ID || SANDBOX.appId;
      const key1 = env.ZALOPAY_KEY1 || SANDBOX.key1;
      const endpoint = env.ZALOPAY_ENDPOINT || SANDBOX.endpoint;

      const appTransId = `${vietnamDatePrefix()}_${order.id}`;
      const appTime = Date.now();
      const appUser = "guest";
      const amount = Math.round(order.amount);
      const embedData = JSON.stringify({ redirecturl: returnUrl });
      const item = "[]";

      const macInput = [appId, appTransId, appUser, amount, appTime, embedData, item].join("|");
      const mac = await hmacSha256Hex(key1, macInput);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          app_id: String(appId),
          app_user: appUser,
          app_time: String(appTime),
          amount: String(amount),
          app_trans_id: appTransId,
          embed_data: embedData,
          item,
          bank_code: "",
          description: order.description || `Thanh toan don hang ${order.id}`,
          callback_url: `${siteUrl}${callbackRoute}`,
          mac
        })
      });
      const json = await res.json();
      if (json.return_code !== 1 || !json.order_url) {
        console.error("ZaloPay tạo đơn lỗi:", JSON.stringify(json));
        throw new PaymentError("ZaloPay từ chối tạo giao dịch", 502);
      }
      return { providerTransId: appTransId, payUrl: json.order_url };
    },

    async handleWebhook({ request, env, confirmPaid }) {
      try {
        const { data, mac } = await request.json();
        const expected = await hmacSha256Hex(env.ZALOPAY_KEY2 || SANDBOX.key2, data);
        if (!timingSafeEqual(expected, mac)) {
          return Response.json({ return_code: -1, return_message: "mac not matched" });
        }

        const info = JSON.parse(data);
        const orderId = String(info.app_trans_id).slice(String(info.app_trans_id).indexOf("_") + 1);
        const result = await confirmPaid(orderId, { amount: info.amount, currency: "VND" });
        if (!result.ok) return Response.json({ return_code: -1, return_message: result.reason });

        return Response.json({ return_code: 1, return_message: "success" });
      } catch (err) {
        console.error(err);
        return Response.json({ return_code: 0, return_message: "error" });
      }
    },
  };
}
