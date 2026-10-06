function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");

    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    }

    if (Array.isArray(data.row)) {
      sheet.appendRow([new Date()].concat(data.row));
    } else {
      sheet.appendRow([
        new Date(),
        data.orderId || "",
        data.method || "",
        data.paymentType || "",
        data.amount || "",
        data.amountUsd || "",
        data.fxRate || "",
        data.status || "",
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
