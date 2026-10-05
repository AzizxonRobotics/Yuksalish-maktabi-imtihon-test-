// Bu kodni script.google.com'da yangi loyihaga joylashtiring (pastdagi yo'riqnomaga qarang)
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const d = JSON.parse(e.postData.contents);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Sana", "Ism-familya", "Sinf", "Ball", "Jami", "Foiz", "Vaqt"]);
  }

  sheet.appendRow([d.sana, d.fio, d.klass, d.score, d.total, d.pct + "%", d.vaqt]);

  return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}
