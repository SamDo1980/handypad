// Dán toàn bộ đoạn này vào Extensions > Apps Script, thay code mặc định.
// Sau khi dán xong, làm theo hướng dẫn "Deploy" ở phần chat.

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");

    // Nếu Sheet của bạn tên khác "Sheet1", sửa dòng trên cho đúng tên tab.
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    }

    sheet.appendRow([
      new Date(),
      data.orderId || "",
      data.method || "",
      data.amount || "",
      data.status || "",
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
