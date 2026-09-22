/**
 * InterviewService.gs — Demo Nhan Su V1.0.0 (G2)
 * Tao LICH_PHONG_VAN tu NHAN_VIEN_MOI -> HR duyet -> sinh NHAN_VIEN_TRAINING.
 * Phu thuoc: Config.gs (CONFIG), Database.gs (getMainSpreadsheet),
 * SyncService.gs (getSheetByIds_, logAudit_).
 */

function extractBranchCode_(full) {
  var m = String(full || "").match(/CN\s*\d/i);
  if (m) return m[0].replace(/\s+/g, "").toUpperCase();
  var m2 = String(full || "").match(/CN[1-4]/i);
  return m2 ? m2[0].toUpperCase() : "";
}

function nextMaCaPV_() {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "LICH_PHONG_VAN");
  var n = Math.max(0, sh.getLastRow() - 1) + 1;
  var d = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMdd");
  return "PV-" + d + "-" + ("00" + n).slice(-3);
}

/** Lay so thu tu Ma NV lon nhat (NV_UBMnnnn) tren cac bang nhan su */
function nextMaNVUBM_() {
  var ss = getMainSpreadsheet();
  var names = ["NHAN_VIEN_TRAINING", "NHAN_VIEN_CHINH_THUC", "NHAN_VIEN_XUONG", "NHAN_VIEN_VAN_PHONG", "NHAN_VIEN_SALE"];
  var max = 0;
  names.forEach(function (nm) {
    var sh = ss.getSheetByName(nm);
    if (!sh || sh.getLastRow() < 2) return;
    var vals = sh.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      var m = String(vals[i][1] || "").match(/(\d{3,5})/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  });
  var next = max + 1;
  return "NV_UBM" + ("0000" + next).slice(-4);
}

/**
 * B1: quet NHAN_VIEN_MOI (NEW_APPLICANT + DAT) chua co trong LICH_PHONG_VAN
 * -> tao dong moi. HR dien Thoi gian hen + Link Meet sau (hoac de mac dinh sang hom sau 09:00).
 */
function createInterviewSchedule() {
  var ss = getMainSpreadsheet();
  var moiSh = ss.getSheetByName("NHAN_VIEN_MOI");
  var pvSh = ss.getSheetByName("LICH_PHONG_VAN");
  var moi = moiSh.getDataRange().getValues();
  var pv = pvSh.getLastRow() > 1 ? pvSh.getDataRange().getValues() : [[]];
  var seenPhone = {};
  for (var i = 1; i < pv.length; i++) {
    var p = String(pv[i][2] || "").replace(/\D/g, "");
    if (p) seenPhone[p] = true;
  }
  var created = 0, skipped = 0;
  for (var r = 1; r < moi.length; r++) {
    var row = moi[r];
    var trangThai = String(row[16] || "");
    var ketQua = String(row[15] || "");
    var sdt = String(row[7] || "").replace(/\D/g, "");
    if (trangThai !== "NEW_APPLICANT" || ketQua !== "DAT" || !sdt) { skipped++; continue; }
    if (seenPhone[sdt]) { skipped++; continue; }
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    pvSh.appendRow([
      nextMaCaPV_(), row[2], sdt, tomorrow, "",
      "CHO_XAC_NHAN", row[14], "AI rule-based Demo V1", ""
    ]);
    seenPhone[sdt] = true;
    created++;
  }
  logAudit_("HR", "CREATE_LICH_PHONG_VAN", "LICH_PHONG_VAN", "", "created=" + created);
  return { success: true, created: created, skipped: skipped };
}

/** B1b: HR tao lich PV cho 1 ung vien theo SDT (nut tren tung dong webapp HR). HR chon ngay gio; trong -> mac dinh sang mai 09:00. */
function createSingleInterview(sdt, thoiGianHen, linkMeet) {
  var phone = String(sdt || "").replace(/\D/g, "");
  if (!phone) throw new Error("Thieu SDT");
  var ss = getMainSpreadsheet();
  var pvSh = ss.getSheetByName("LICH_PHONG_VAN");
  var pv = pvSh.getLastRow() > 1 ? pvSh.getDataRange().getValues() : [[]];
  for (var i = 1; i < pv.length; i++) {
    if (String(pv[i][2] || "").replace(/\D/g, "") === phone) {
      throw new Error("SĐT nay da co lich PV (" + pv[i][0] + ")");
    }
  }
  var moi = ss.getSheetByName("NHAN_VIEN_MOI").getDataRange().getValues();
  for (var r = 1; r < moi.length; r++) {
    if (String(moi[r][7] || "").replace(/\D/g, "") !== phone) continue;
    if (String(moi[r][16]) !== "NEW_APPLICANT" || String(moi[r][15]) !== "DAT") {
      throw new Error("Ung vien chua du dieu kien (trang thai: " + moi[r][16] + ", ket qua: " + moi[r][15] + ")");
    }
    var hen = thoiGianHen ? new Date(thoiGianHen) : new Date();
    if (!thoiGianHen) { hen.setDate(hen.getDate() + 1); hen.setHours(9, 0, 0, 0); }
    if (isNaN(hen.getTime())) throw new Error("Ngay gio hen khong hop le");
    var maCa = nextMaCaPV_();
    var meet = linkMeet || ((typeof autoMeetLink_ === "function") ? autoMeetLink_("PV " + moi[r][2], hen, 45) : "");
    pvSh.appendRow([maCa, moi[r][2], phone, hen, meet, "CHO_XAC_NHAN", moi[r][14], "AI rule-based Demo V1", ""]);
    logAudit_("HR", "CREATE_1_LICH_PV", "LICH_PHONG_VAN", phone, maCa);
    var invite = { sent: false };
    try { invite = sendInterviewInviteZalo(maCa); } catch (e) { invite = { sent: false, error: String((e && e.message) || e) }; }
    return { success: true, maCa: maCa, ten: moi[r][2], sdt: phone, linkMeet: meet, auto: !linkMeet, zaloInvite: invite };
  }
  throw new Error("Khong tim thay ung vien voi SDT: " + phone);
}

/** Gui thu moi PV qua Zalo (OA that neu co token, khong thi log SIMULATED de HR nhan tay). Trang thai -> DA_GUI_MOI (cho xac nhan). */
function sendInterviewInviteZalo(maCa) {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "LICH_PHONG_VAN");
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) !== String(maCa)) continue;
    var cur = String(vals[i][5] || "");
    if (cur === "DA_XAC_NHAN") throw new Error("Lich da khoa (nhan vien da xac nhan), khong gui lai");
    var hen = vals[i][3] instanceof Date ? vals[i][3].toLocaleString("vi-VN") : vals[i][3];
    var text = "[UBM MOI PV] Xin chao " + vals[i][1] + ", ban co lich phong van luc " + hen
      + ". Meet: " + (vals[i][4] || "(HR se cap nhat)")
      + ". Tra loi " + maCa + " DONG Y de xac nhan (BOT tu khoa lich), hoac " + maCa + " TU CHOI + ly do.";
    var sent = sendZaloInvite_(String(vals[i][2]), text);
    sh.getRange(i + 1, 6).setValue("DA_GUI_MOI");
    logAudit_("HR", "SEND_ZALO_INVITE", "LICH_PHONG_VAN", maCa, sent.real ? "SENT_OA" : "SIMULATED");
    return { success: true, maCa: maCa, sent: sent.real, simulated: !sent.real };
  }
  throw new Error("Khong tim thay Ma ca: " + maCa);
}

/** BOT ca nhan poll: danh sach lich PV dang cho xac nhan */
function listPendingPV_() {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "LICH_PHONG_VAN");
  var out = [];
  if (sh.getLastRow() > 1) {
    var vals = sh.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      var st = String(vals[i][5] || "");
      if (st === "CHO_XAC_NHAN" || st === "DA_GUI_MOI") {
        out.push({ maCa: vals[i][0], ten: vals[i][1], sdt: String(vals[i][2]), hen: vals[i][3] instanceof Date ? vals[i][3].toISOString() : vals[i][3], trangThai: st });
      }
    }
  }
  return { success: true, data: out };
}

/**
 * BOT ghi nhan reply Zalo cua ung vien -> khoa lich.
 * text chua DONG Y/XAC NHAN/OK -> DA_XAC_NHAN (khoa). Chua TU CHOI/HUY -> TU_CHOI.
 */
function handleZaloReply(maCa, replyText) {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "LICH_PHONG_VAN");
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) !== String(maCa)) continue;
    var cur = String(vals[i][5] || "");
    if (cur === "DA_XAC_NHAN") return { success: true, maCa: maCa, trangThai: cur, note: "Lich da khoa truoc do" };
    var t = String(replyText || "").toLowerCase();
    var st = (t.indexOf("tu choi") >= 0 || t.indexOf("tuchoi") >= 0 || t.indexOf("huy") >= 0 || t.indexOf("khong tham gia") >= 0)
      ? "TU_CHOI" : "DA_XAC_NHAN";
    sh.getRange(i + 1, 6).setValue(st);
    logAudit_("ZALO_BOT", "ZALO_REPLY_LOCK", "LICH_PHONG_VAN", maCa, st + "|" + String(replyText).substring(0, 200));
    try { logZalo_(String(vals[i][2]), "XAC_NHAN_PV", "Reply: " + replyText + " => " + st, "RECORDED", ""); } catch (e) {}
    return { success: true, maCa: maCa, trangThai: st, locked: st === "DA_XAC_NHAN" };
  }
  throw new Error("Khong tim thay Ma ca: " + maCa);
}

/** B2: HR xac nhan lich (doi trang thai + danh gia). Ma ca la cot 0. */
function confirmInterview(maCa, xacNhan, danhGiaChung) {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "LICH_PHONG_VAN");
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(maCa)) {
      if (String(vals[i][5]) === "DA_XAC_NHAN") throw new Error("Lich da khoa (nhan vien da xac nhan qua Zalo), khong doi duoc nua");
      sh.getRange(i + 1, 6).setValue(xacNhan); // Trang thai xac nhan
      if (danhGiaChung) sh.getRange(i + 1, 9).setValue(danhGiaChung);
      logAudit_("HR", "CONFIRM_LICH_PHONG_VAN", "LICH_PHONG_VAN", maCa, xacNhan);
      return { success: true, maCa: maCa, xacNhan: xacNhan };
    }
  }
  throw new Error("Khong tim thay Ma ca: " + maCa);
}

/**
 * B3: PASS phong van -> sinh NHAN_VIEN_TRAINING + cap nhat NHAN_VIEN_MOI.
 * Khoa kich hoat = SDT (Admin kich hoat sau). Ngay KT = Ngay BD + 12 ngay.
 */
function passInterviewToTraining(maCa) {
  var ss = getMainSpreadsheet();
  var pvSh = ss.getSheetByName("LICH_PHONG_VAN");
  var pv = pvSh.getDataRange().getValues();
  var found = null, foundRow = -1;
  for (var i = 1; i < pv.length; i++) {
    if (String(pv[i][0]) === String(maCa)) { found = pv[i]; foundRow = i + 1; break; }
  }
  if (!found) throw new Error("Khong tim thay Ma ca: " + maCa);

  var ten = found[1], sdt = String(found[2] || "").replace(/\D/g, "");
  // Tra cuu CN + Ca goc tu NHAN_VIEN_MOI theo SDT
  var moiSh = ss.getSheetByName("NHAN_VIEN_MOI");
  var moi = moiSh.getDataRange().getValues();
  var cn = "", ca = "", moiRow = -1;
  for (var j = 1; j < moi.length; j++) {
    if (String(moi[j][7] || "").replace(/\D/g, "") === sdt) {
      cn = extractBranchCode_(moi[j][9]); ca = moi[j][8]; moiRow = j + 1; break;
    }
  }
  // Chong tao trung Training theo SDT
  var trSh = ss.getSheetByName("NHAN_VIEN_TRAINING");
  var tr = trSh.getLastRow() > 1 ? trSh.getDataRange().getValues() : [[]];
  for (var k = 1; k < tr.length; k++) {
    if (String(tr[k][3] || "").replace(/\D/g, "") === sdt) {
      return { success: false, message: "SDT da co trong TRAINING", sdt: sdt };
    }
  }
  var bd = new Date(); var kt = new Date(); kt.setDate(kt.getDate() + 12);
  var maNV = nextMaNVUBM_();
  trSh.appendRow([
    Utilities.getUuid(), maNV, ten, sdt, sdt, cn, ca, bd, kt,
    12, "DANG_TRAINING", "", "", "TRAINING", "CUA_HANG", 1, new Date(), "FALSE"
  ]);
  pvSh.getRange(foundRow, 6).setValue("PASS");
  if (moiRow > 0) moiSh.getRange(moiRow, 17).setValue("DA_TAO_TRAINING");
  logAudit_("HR", "PASS_PV_TO_TRAINING", "NHAN_VIEN_TRAINING", maCa, maNV + "|" + sdt);
  return { success: true, maCa: maCa, maNV: maNV, ten: ten, sdt: sdt, chiNhanh: cn };
}

/** FAIL phong van -> danh dau de khong tao lich lai */
function failInterview(maCa, lyDo) {
  var r = confirmInterview(maCa, "FAIL", lyDo || "Khong dat PV");
  var ss = getMainSpreadsheet();
  var pv = ss.getSheetByName("LICH_PHONG_VAN").getDataRange().getValues();
  var sdt = "";
  for (var i = 1; i < pv.length; i++) {
    if (String(pv[i][0]) === String(maCa)) { sdt = String(pv[i][2] || "").replace(/\D/g, ""); break; }
  }
  if (sdt) {
    var moiSh = ss.getSheetByName("NHAN_VIEN_MOI");
    var moi = moiSh.getDataRange().getValues();
    for (var j = 1; j < moi.length; j++) {
      if (String(moi[j][7] || "").replace(/\D/g, "") === sdt) {
        moiSh.getRange(j + 1, 17).setValue("LOAI_PV");
        break;
      }
    }
  }
  return r;
}
