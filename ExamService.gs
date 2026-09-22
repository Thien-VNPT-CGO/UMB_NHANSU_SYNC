/**
 * ExamService.gs — Demo Nhan Su V1.0.0 (thi dau ra Chinh thuc)
 * HR tao khoa -> dat lich LICH_TEST_DAU_RA -> cham diem -> ghi KET_QUA_TEST.
 * Phu thuoc: Config.gs, SyncService.gs (getSheetByIds_, logAudit_).
 */

function nextMaKhoa_() {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "KHOA_TEST");
  var n = Math.max(0, sh.getLastRow() - 1) + 1;
  return "KHOA-" + ("00" + n).slice(-3);
}

function nextMaTestDauRa_() {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "LICH_TEST_DAU_RA");
  var n = Math.max(0, sh.getLastRow() - 1) + 1;
  var d = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMdd");
  return "TEST-" + d + "-" + ("00" + n).slice(-3);
}

function xepLoaiTest_(diem) {
  if (diem >= 8) return "GIOI";
  if (diem >= 6.5) return "KHA";
  if (diem >= 5) return "TRUNG_BINH";
  return "LOAI";
}

function findOfficialBySDT_(sdt) {
  var phone = String(sdt || "").replace(/\D/g, "");
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "NHAN_VIEN_CHINH_THUC");
  if (sh.getLastRow() < 2) return null;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][3] || "").replace(/\D/g, "") === phone) return { sheet: sh, row: i + 1, data: vals[i] };
  }
  return null;
}

/** HR tao khoa test (vd: Nghiep vu co ban, 25 cau) */
function createKhoaTest(tenKhoa, soCau, toiThieu) {
  var id = nextMaKhoa_();
  getSheetByIds_(CONFIG.SPREADSHEET_ID, "KHOA_TEST")
    .appendRow([id, tenKhoa, soCau || 25, toiThieu || "", new Date()]);
  logAudit_("HR", "CREATE_KHOA_TEST", "KHOA_TEST", "", id);
  return { success: true, maKhoa: id };
}

/** HR dat lich thi dau ra cho NV chinh thuc */
function scheduleOfficialTest(ten, sdt, thoiGianHen, linkMeet) {
  var off = findOfficialBySDT_(sdt);
  if (!off) throw new Error("SDT chua la Nhan vien Chinh thuc");
  var ma = nextMaTestDauRa_();
  var meet = linkMeet || ((typeof autoMeetLink_ === "function") ? autoMeetLink_("Test dau ra " + (ten || off.data[2]), new Date(thoiGianHen), 60) : "");
  getSheetByIds_(CONFIG.SPREADSHEET_ID, "LICH_TEST_DAU_RA").appendRow([
    ma, ten || off.data[2], String(sdt).replace(/\D/g, ""),
    new Date(thoiGianHen), meet, "", "", ""
  ]);
  logAudit_("HR", "SCHEDULE_TEST_DAU_RA", "LICH_TEST_DAU_RA", sdt, ma);
  return { success: true, maTest: ma, linkMeet: meet, auto: !linkMeet };
}

/** HR cham diem: cap nhat lich + ghi KET_QUA_TEST + cap nhat Diem TEST chinh thuc */
function gradeOfficialTest(maTest, diem, nhanXet) {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "LICH_TEST_DAU_RA");
  var vals = sh.getDataRange().getValues();
  var found = null, row = -1;
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(maTest)) { found = vals[i]; row = i + 1; break; }
  }
  if (!found) throw new Error("Khong tim thay Ma test: " + maTest);
  var xep = xepLoaiTest_(Number(diem));
  sh.getRange(row, 6).setValue(Number(diem));
  sh.getRange(row, 7).setValue(nhanXet || "");
  sh.getRange(row, 8).setValue(xep);

  var off = findOfficialBySDT_(found[2]);
  if (off) {
    getSheetByIds_(CONFIG.SPREADSHEET_ID, "KET_QUA_TEST").appendRow([
      Utilities.getUuid(), off.data[1], off.data[2], maTest, Number(diem), "", xep, "", new Date()
    ]);
    off.sheet.getRange(off.row, 10).setValue(Number(diem)); // Diem TEST chinh thuc
  }
  logAudit_("HR", "GRADE_TEST_DAU_RA", "LICH_TEST_DAU_RA", maTest, diem + "=" + xep);
  return { success: true, maTest: maTest, diem: Number(diem), xepLoai: xep };
}
