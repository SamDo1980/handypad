export function googleSheetStep({ toPayload }) {
  return {
    name: "google-sheet",
    enabled: (env) => Boolean(env.GOOGLE_SHEETS_WEBHOOK_URL),
    async run(env, order) {
      const res = await fetch(env.GOOGLE_SHEETS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(order)),
        redirect: "follow"
      });
      if (!res.ok) {
        throw new Error(`Google Sheets webhook lỗi: ${res.status} ${await res.text()}`);
      }
    }
  };
}
