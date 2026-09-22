/**
 * SyncService.gs — Demo Nhan Su V1.0.0 (G1)
 * Dong bo Form 1rcq -> NHAN_VIEN_MOI + cham Diem AI rule-based + auto-loai.
 * Mapping cot Form (A-N) -> NHAN_VIEN_MOI (20 cot). Chay bang trigger 10 phut.
 */

function normalizeStr_(s) {
  s = String(s || "").toLowerCase();
  s = s.replace(/[dđ]/g, "d");
  try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
  return s;
}

/** Cham diem AI demo (khong goi Gemini): tra ve {diem, ketQua, lyDo} */
function scoreApplicantAI_(r) {
  var diem = 5; // diem san
  var ly = [];
  var kn = normalizeStr_(r.kinhNghiem);
  if (kn.indexOf("fnb") >= 0 || kn.indexOf("f&b") >= 0) { diem += 3; ly.push("KN FNB+3"); }
  else if (kn.indexOf("khac") >= 0) { diem += 2; ly.push("KN khac+2"); }
  else if (kn.indexOf("khong") >= 0) { diem += 1; ly.push("Chua KN+1"); }
  else { diem += 1; }

  var xuLy = String(r.xuLy || "");
  if (xuLy.length >= 80) { diem += 3; ly.push("Xu ly tot+3"); }
  else if (xuLy.length >= 30) { diem += 2; ly.push("Xu ly TB+2"); }
  else { diem += 1; ly.push("Xu ly yeu+1"); }

  var ca = normalizeStr_(r.ca);
  if (ca.indexOf("2 ca") >= 0) { diem += 2; ly.push("Linh hoat ca+2"); }
  else { diem += 1; ly.push("1 ca+1"); }

  diem = Math.max(8, Math.min(13, diem));
  return { diem: diem, ketQua: diem >= 10 ? "DAT" : "KHONG_DAT", lyDo: ly.join("; ") };
}

function isReferralSource_(nguon) {
  var n = normalizeStr_(nguon);
  return (n.indexOf("ban be") >= 0 && n.indexOf("gioi thieu") >= 0) ||
         (n.indexOf("nguoi quen") >= 0 && n.indexOf("gioi thieu") >= 0);
}

function getSheetByIds_(spreadsheetId, sheetName) {
  return SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
}

/** Ham chinh G1. Tra ve {inserted, rejected, skipped} */
function syncFormToNhanVienMoi() {
  var formSh = getSheetByIds_(CONFIG.CANDIDATE_FORM_SHEET_ID, "Form Responses 1")
    || SpreadsheetApp.openById(CONFIG.CANDIDATE_FORM_SHEET_ID).getSheets()[0];
  var mainSh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "NHAN_VIEN_MOI");
  var data = formSh.getDataRange().getValues();
  if (data.length < 2) return { inserted: 0, rejected: 0, skipped: 0 };

  // Tap SDT + Ma nguon da co de chong trung
  var existing = mainSh.getDataRange().getValues();
  var seenPhone = {};
  var seenSource = {};
  for (var i = 1; i < existing.length; i++) {
    var phone = String(existing[i][7] || "").replace(/\D/g, "");
    if (phone) seenPhone[phone] = true;
    var src = String(existing[i][17] || "");
    if (src) seenSource[src] = true;
  }

  var inserted = 0, rejected = 0, skipped = 0;
  var now = new Date();
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var ts = row[0], ten = row[1], gioi = row[2], ns = row[3], td = row[4],
        que = row[5], sdt = String(row[6] || "").replace(/\D/g, ""),
        ca = row[7], cn = row[8], kn = row[9], xuly = row[10],
        fb = row[11], nguon = row[12];
    if (!sdt || !ten) { skipped++; continue; }
    var maNguon = "sheet_live_" + Utilities.getUuid();
    // Chong trung theo SDT (chuan noi bo)
    if (seenPhone[sdt]) { skipped++; continue; }

    var ai = scoreApplicantAI_({ kinhNghiem: kn, xuLy: xuly, ca: ca });
    var trangThai = isReferralSource_(nguon) ? "REJECTED" : "NEW_APPLICANT";
    if (trangThai === "REJECTED") rejected++;

    mainSh.appendRow([
      Utilities.getUuid(),
      ts instanceof Date ? ts : now,
      ten, gioi, ns, td, que, sdt, ca, cn, kn, xuly, fb, nguon,
      ai.diem, ai.ketQua, trangThai, maNguon, 1, now
    ]);
    seenPhone[sdt] = true;
    inserted++;
    logAudit_("SYNC", "INSERT_NHAN_VIEN_MOI", "NHAN_VIEN_MOI", "", sdt + "|" + ai.diem + "|" + trangThai);
  }
  return { success: true, inserted: inserted, rejected: rejected, skipped: skipped };
}

function logAudit_(actor, action, entity, before, after) {
  try {
    getSheetByIds_(CONFIG.SPREADSHEET_ID, "AUDIT_LOG")
      .appendRow([Utilities.getUuid(), actor, action, entity, String(before).substring(0, 4000), String(after).substring(0, 4000), new Date(), ""]);
  } catch (e) {}
}

/** Cai trigger 10 phut 1 lan (chay 1 lan trong Editor) */
function installSyncTrigger10m() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "syncFormToNhanVienMoi") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("syncFormToNhanVienMoi").timeBased().everyMinutes(10).create();
  return { success: true };
}
