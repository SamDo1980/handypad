import { hmacSha256Hex } from "./hmac.js";

const DEFAULTS = {
  endpoint: "https://sb-openapi.zalopay.vn/v2/create",
  appId: "2553",
  key1: "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL",
  key2: "kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz",
};

function todayPrefix() {
  const d = new Date();
  const yy = String(d.getUTCFullYear()).slice(2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export async function createZaloPayOrder(env, { orderId, amount, description, bankCode = "" }) {
  const appId = env.ZALOPAY_APP_ID || DEFAULTS.appId;
  const key1 = env.ZALOPAY_KEY1 || DEFAULTS.key1;
  const endpoint = env.ZALOPAY_ENDPOINT || DEFAULTS.endpoint;

  const appTransId = `${todayPrefix()}_${orderId}`;
  const appTime = Date.now();
  const appUser = "guest";
  const embedData = JSON.stringify({
    redirecturl: `${env.SITE_URL}/success.html?orderId=${orderId}`,
  });
  const item = "[]";

  const macInput = [appId, appTransId, appUser, amount, appTime, embedData, item].join("|");
  const mac = await hmacSha256Hex(key1, macInput);

  const body = new URLSearchParams({
    app_id: String(appId),
    app_user: appUser,
    app_time: String(appTime),
    amount: String(amount),
    app_trans_id: appTransId,
    embed_data: embedData,
    item,
    bank_code: bankCode,
    description: description || `Thanh toan don hang ${orderId}`,
    mac,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();

  return { appTransId, raw: json };
}

export async function verifyZaloPayCallback(env, data, mac) {
  const key2 = env.ZALOPAY_KEY2 || DEFAULTS.key2;
  const expected = await hmacSha256Hex(key2, data);
  return expected === mac;
}
