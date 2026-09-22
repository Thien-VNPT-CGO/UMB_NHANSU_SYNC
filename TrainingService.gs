/**
 * TrainingService.gs — Demo Nhan Su V1.0.0 (G3)
 * Admin duyet SDT -> NV dky 5 OFF -> auto lich 12 ngay -> diem danh -> thi -> len Chinh thuc.
 * Phu thuoc: Config.gs, Database.gs (getMainSpreadsheet),
 * SyncService.gs (getSheetByIds_, logAudit_).
 */

function findTrainingByMaNV_(maNV) {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "NHAN_VIEN_TRAINING");
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][1]) === String(maNV)) return { sheet: sh, row: i + 1, data: vals[i] };
  }
  throw new Error("Khong tim thay Ma NV Training: " + maNV);
}

function fmtDate_(d) {
  return Utilities.formatDate(new Date(d), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
}

function weekdayVN_(d) {
  var names = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return names[new Date(d).getDay()];
}

/** B1: Admin duyet / kich hoat SDT thu viec (Khoa = SDT giu nguyen) */
function approveTrainingPhone(maNV) {
  var f = findTrainingByMaNV_(maNV);
  f.sheet.getRange(f.row, 11).setValue("DA_DUYET"); // Trang thai
  f.sheet.getRange(f.row, 18).setValue("TRUE");     // Dong bo
  logAudit_("ADMIN", "APPROVE_TRAINING_PHONE", "NHAN_VIEN_TRAINING", maNV, "DA_DUYET");
  return { success: true, maNV: maNV, trangThai: "DA_DUYET" };
}

/**
 * B2: NV dang ky 5 ngay nghi (mang 'yyyy-MM-dd').
 * Validate: dung 5 ngay, duy nhat, nam trong [Ngay BD, Ngay KT].
 * -> sinh 12 dong LICH_LAM_VIEC: OFF neu trong danh sach, con lai LAM.
 */
function registerTrainingOff(maNV, offDates) {
  var f = findTrainingByMaNV_(maNV);
  if (String(f.data[10]) !== "DA_DUYET") throw new Error("NV chua duoc Admin kich hoat: " + maNV);
  if (!offDates || offDates.length !== 5) throw new Error("Phai dang ky dung 5 ngay nghi");

  var bd = new Date(f.data[7]), kt = new Date(f.data[8]);
  bd.setHours(0, 0, 0, 0); kt.setHours(0, 0, 0, 0);
  var offSet = {};
  offDates.forEach(function (d) {
    var key = fmtDate_(d);
    if (offSet[key]) throw new Error("Trung ngay OFF: " + key);
    var t = new Date(d); t.setHours(0, 0, 0, 0);
    if (t < bd || t > kt) throw new Error("Ngay OFF ngoai window 12 ngay: " + key);
    offSet[key] = true;
  });

  var ss = getMainSpreadsheet();
  var lichSh = ss.getSheetByName("LICH_LAM_VIEC");
  // Xoa lich cu cua NV nay trong window (idempotent)
  var vals = lichSh.getLastRow() > 1 ? lichSh.getDataRange().getValues() : [[]];
  var toDelete = [];
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][1]) === String(maNV)) toDelete.push(i + 1);
  }
  toDelete.reverse().forEach(function (r) { lichSh.deleteRow(r); });

  var ten = f.data[2], cn = f.data[5], ca = f.data[6];
  var tuanBd = fmtDate_(bd);
  for (var d = new Date(bd); d <= kt; d.setDate(d.getDate() + 1)) {
    var key = fmtDate_(d);
    var isOff = !!offSet[key];
    lichSh.appendRow([
      Utilities.getUuid(), maNV, ten, cn, tuanBd, new Date(d),
      weekdayVN_(d), isOff ? "OFF" : ca, isOff ? "OFF_TRAINING" : "LICH_LAM", "", 1
    ]);
  }
  logAudit_(maNV, "REGISTER_5_OFF", "LICH_LAM_VIEC", maNV, offDates.join(","));
  return { success: true, maNV: maNV, off: offDates, lam: 7 };
}

/** Dem so ca COMPLETED (co ca vao + ra) cua NV */
function countCompletedShifts_(maNV) {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "RECORD_DIEM_DANH");
  if (sh.getLastRow() < 2) return 0;
  var vals = sh.getDataRange().getValues();
  var c = 0;
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][1]) === String(maNV) && String(vals[i][14]) === "COMPLETED") c++;
  }
  return c;
}

/**
 * B3: Diem danh. kind = 'IN' | 'OUT'. gpsDist (m) > 300 -> tu choi.
 * anhUrl/driveUrl co the rong o Demo (luu truoc, siet sau).
 */
function trainingAttendance(maNV, kind, opts) {
  opts = opts || {};
  if (opts.gpsDist != null && Number(opts.gpsDist) > 300) {
    throw new Error("Ngoai pham vi 300m (dist=" + opts.gpsDist + "m)");
  }
  var f = findTrainingByMaNV_(maNV);
  var ss = getMainSpreadsheet();
  var recSh = ss.getSheetByName("RECORD_DIEM_DANH");
  var today = fmtDate_(opts.ngay || new Date());
  var vals = recSh.getLastRow() > 1 ? recSh.getDataRange().getValues() : [[]];
  var rowIdx = -1;
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][1]) === String(maNV) && fmtDate_(vals[i][3]) === today) { rowIdx = i + 1; break; }
  }
  var now = opts.gio || new Date();
  if (kind === "IN") {
    if (rowIdx < 0) {
      recSh.appendRow([Utilities.getUuid(), maNV, f.data[2], new Date(), f.data[6], f.data[5],
        now, opts.gps || "", opts.anh || "", opts.drive || "",
        "", "", "", "", "CHECKED_IN", "", 1]);
    } else {
      recSh.getRange(rowIdx, 7).setValue(now);
      if (opts.gps) recSh.getRange(rowIdx, 8).setValue(opts.gps);
      if (opts.anh) recSh.getRange(rowIdx, 9).setValue(opts.anh);
      if (opts.drive) recSh.getRange(rowIdx, 10).setValue(opts.drive);
      recSh.getRange(rowIdx, 15).setValue("CHECKED_IN");
    }
  } else if (kind === "OUT") {
    if (rowIdx < 0) throw new Error("Chua check-IN hom nay, khong the OUT");
    recSh.getRange(rowIdx, 11).setValue(now);
    if (opts.gps) recSh.getRange(rowIdx, 12).setValue(opts.gps);
    if (opts.anh) recSh.getRange(rowIdx, 13).setValue(opts.anh);
    if (opts.drive) recSh.getRange(rowIdx, 14).setValue(opts.drive);
    recSh.getRange(rowIdx, 15).setValue("COMPLETED");
  } else {
    throw new Error("kind phai la IN hoac OUT");
  }
  logAudit_(maNV, "DIEM_DANH_" + kind, "RECORD_DIEM_DANH", maNV, today);
  try { notifyCheckin(maNV, kind); } catch (e) {}
  return { success: true, maNV: maNV, kind: kind, ngay: today };
}

/**
 * B4: Nhan diem test (sau du 7 ca). Ghi KET_QUA_TEST + cap nhat TRAINING.
 * Quy uoc Demo: >= 8 DAT, 5-<8 CHUA_DU_DK, <5 LOAI.
 */
function submitTrainingTest(maNV, diem, dung, tong, khoa) {
  var done = countCompletedShifts_(maNV);
  if (done < 7) throw new Error("Chua du 7 ca COMPLETED (hien co " + done + ")");
  var kq = diem >= 8 ? "DAT" : (diem >= 5 ? "CHUA_DU_DK" : "LOAI");
  var f = findTrainingByMaNV_(maNV);
  getSheetByIds_(CONFIG.SPREADSHEET_ID, "KET_QUA_TEST").appendRow([
    Utilities.getUuid(), maNV, f.data[2], khoa || "KHOA-TV-01",
    diem, (dung != null ? dung + "/" + tong : ""), kq, "", new Date()
  ]);
  f.sheet.getRange(f.row, 12).setValue(diem);
  f.sheet.getRange(f.row, 13).setValue(kq);
  logAudit_("HR", "SUBMIT_TRAINING_TEST", "KET_QUA_TEST", maNV, diem + "=" + kq);
  return { success: true, maNV: maNV, diem: diem, ketQua: kq, caHoanThanh: done };
}

/** B5: DAT -> len Chinh thuc (giữ nguyen Ma NV). */
function promoteToOfficial(maNV) {
  var f = findTrainingByMaNV_(maNV);
  if (String(f.data[12]) !== "DAT") throw new Error("Chua DAT test, khong the len Chinh thuc");
  var ss = getMainSpreadsheet();
  var ctSh = ss.getSheetByName("NHAN_VIEN_CHINH_THUC");
  var ct = ctSh.getLastRow() > 1 ? ctSh.getDataRange().getValues() : [[]];
  for (var i = 1; i < ct.length; i++) {
    if (String(ct[i][1]) === String(maNV)) return { success: false, message: "Da la Chinh thuc", maNV: maNV };
  }
  var now = new Date();
  ctSh.appendRow([Utilities.getUuid(), maNV, f.data[2], f.data[3], f.data[4],
    f.data[5], f.data[6], now, "DA_DUYET", f.data[11], "OFFICIAL", now, 1, now, "FALSE"]);
  f.sheet.getRange(f.row, 11).setValue("DA_LEN_CHINH_THUC");
  logAudit_("ADMIN", "PROMOTE_TO_OFFICIAL", "NHAN_VIEN_CHINH_THUC", maNV, maNV);
  return { success: true, maNV: maNV };
}
