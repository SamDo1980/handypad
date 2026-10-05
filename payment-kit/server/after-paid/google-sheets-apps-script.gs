// Paste into the target Google Sheet: Extensions > Apps Script, then
// Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
// Put the Web app URL in GOOGLE_SHEETS_WEBHOOK_URL.
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");

    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    }

    if (Array.isArray(data.row)) {
      // Generic form: { row: [...] } — the project decides the columns.
      sheet.appendRow([new Date()].concat(data.row));
    } else {
      // Named-field form (HANDYPAD's columns).
      sheet.appendRow([
        new Date(),
        data.orderId || "",
        data.method || "",
        data.paymentType || "",
        data.amount || "",            // tổng đơn hàng (VND)
        data.amountUsd || "",         // số USD đã thu, chỉ có với đơn PayPal
        data.fxRate || "",
        data.status || "",            // trạng thái thanh toán thật, luôn là PAID tại đây
        data.customerName || "",
        data.customerEmail || "",
        data.customerPhone || "",
      ]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
