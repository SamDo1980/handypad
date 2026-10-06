// The page the payment popup lands on when the gateway sends the customer back.
// It tells the shop page (same origin, via BroadcastChannel) that the customer
// has returned, then closes the popup. Whether the order is really paid is still
// decided by the server (webhook / capture), never by this page.
//
// Query it understands: ?cancelled=1 (PayPal cancel), ?status=<n> (ZaloPay: 1 = paid).
export const RETURN_CHANNEL = "payment-kit";

export function returnPageResponse(siteUrl) {
  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Payment</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 16px/1.5 system-ui, sans-serif; color: #17364f; background: #f6f8fa; text-align: center; }
  a { color: inherit; }
</style>
</head>
<body>
<main>
  <p>Đang quay lại trang mua hàng…<br>Returning to the store…</p>
  <p><a id="back" href="/">Quay lại / Go back</a></p>
</main>
<script>
  var site = ${JSON.stringify(siteUrl).replace(/</g, "\\u003c")};
  document.getElementById("back").href = site;
  var query = new URLSearchParams(location.search);
  var failed = query.has("cancelled") || (query.has("status") && query.get("status") !== "1");
  try {
    var channel = new BroadcastChannel(${JSON.stringify(RETURN_CHANNEL)});
    channel.postMessage({ type: "payment-return", outcome: failed ? "failed" : "returned" });
    channel.close();
  } catch (error) {}
  window.close();
  // Still here: the browser did not allow closing (opened as a normal tab), so go back to the shop.
  setTimeout(function () { location.replace(site); }, 1500);
</script>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
