function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");

    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    }

    sheet.appendRow([
      new Date(),
      data.orderId || "",
      data.method || "",
      data.paymentType || "",       // "Đặt cọc" hoặc "Thanh toán đầy đủ" — KHÔNG phải trạng thái
      data.amount || "",
      data.amountUsd || "",         // chỉ có giá trị với đơn đặt cọc (5 USD)
      data.fxRate || "",            // tỷ giá USD->VND áp dụng lúc tạo đơn (đặt cọc)
      data.status || "",            // trạng thái thanh toán thật, luôn là PAID tại đây
      data.customerName || "",
      data.customerEmail || "",
      data.customerPhone || "",
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
