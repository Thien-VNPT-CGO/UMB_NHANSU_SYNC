/**
 * DataService.gs — Demo Nhan Su V1.0.0 (doc bang + dashboard cho frontend)
 * Phu thuoc: SyncService.gs (getSheetByIds_), AuthService.gs (verifyToken_).
 */

var READABLE_TABLES_ = ["NHAN_VIEN_MOI", "NHAN_VIEN_TRAINING", "NHAN_VIEN_CHINH_THUC",
  "NHAN_VIEN_XUONG", "NHAN_VIEN_VAN_PHONG", "NHAN_VIEN_SALE", "LICH_PHONG_VAN",
  "LICH_TEST_DAU_RA", "LICH_LAM_VIEC", "RECORD_DIEM_DANH", "CHAM_CONG",
  "PHIEU_OFF_HANG_TUAN", "PHIEU_OFF_DOT_XUAT", "PHIEU_DOI_CA_OFFICIAL",
  "PHIEU_DOI_CA_TRAINING", "KHOA_TEST", "KET_QUA_TEST", "BAO_CAO_CHAM_CONG",
  "TAI_KHOAN", "AUDIT_LOG", "RECORD_ZALO", "SYNC_QUEUE"];

/**
 * Doc bang: opts {limit, offset, search, statusCol, statusVal}
 * An cot PIN_hash cua TAI_KHOAN. Nhan vien chi duoc doc dong cua minh.
 */
function listTable(sheetName, opts, token) {
  var sess = verifyToken_(token);
  if (READABLE_TABLES_.indexOf(sheetName) < 0) throw new Error("Bang khong duoc phep doc: " + sheetName);
  opts = opts || {};
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, sheetName);
  if (sh.getLastRow() < 1) return { headers: [], rows: [], total: 0 };
  var vals = sh.getDataRange().getValues();
  var headers = vals[0].map(function (h) { return String(h); });
  var hideIdx = sheetName === "TAI_KHOAN" ? 6 : -1; // MA PIN
  var search = String(opts.search || "").toLowerCase();
  var rows = [], rowNums = [];
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    // Nhan vien: loc theo SDT cua minh (cot SDT/MaNV tuy bang)
    if (sess.role === "NHAN_VIEN") {
      var mine = false;
      for (var c = 0; c < r.length; c++) {
        var h = headers[c].toLowerCase();
        if ((h.indexOf("sdt") >= 0 || h.indexOf("dien thoai") >= 0) && String(r[c]).replace(/\D/g, "") === sess.sdt) { mine = true; break; }
        if ((h === "ma nv" || h === "ma ca" || h === "ma test") && String(r[c]) === sess.maNV) { mine = true; break; }
      }
      if (!mine) continue;
    }
    if (opts.statusCol != null && String(r[opts.statusCol]) !== String(opts.statusVal)) continue;
    if (search) {
      var hit = false;
      for (var k = 0; k < r.length; k++) {
        if (String(r[k]).toLowerCase().indexOf(search) >= 0) { hit = true; break; }
      }
      if (!hit) continue;
    }
    var row = r.map(function (v) { return v instanceof Date ? v.toISOString() : v; });
    if (hideIdx >= 0) row[hideIdx] = "***";
    rows.push(row);
    rowNums.push(i + 1);
  }
  var total = rows.length;
  var offset = opts.offset || 0, limit = opts.limit || 100;
  return { headers: headers, rows: rows.slice(offset, offset + limit), rowNums: rowNums.slice(offset, offset + limit), total: total };
}

function getDashboard(token) {
  verifyToken_(token);
  var ss = getMainSpreadsheet();
  function count(name, colIdx, val) {
    var sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return 0;
    var v = sh.getDataRange().getValues(), c = 0;
    for (var i = 1; i < v.length; i++) {
      if (colIdx == null) c++;
      else if (String(v[i][colIdx]) === val) c++;
    }
    return c;
  }
  return {
    success: true,
    moiNew: count("NHAN_VIEN_MOI", 16, "NEW_APPLICANT"),
    moiRejected: count("NHAN_VIEN_MOI", 16, "REJECTED"),
    training: count("NHAN_VIEN_TRAINING"),
    chinhThuc: count("NHAN_VIEN_CHINH_THUC"),
    swapPending: count("PHIEU_DOI_CA_OFFICIAL", 8, "PENDING"),
    pvCho: count("LICH_PHONG_VAN", 5, "CHO_XAC_NHAN")
  };
}

/* ===== CRUD dung chung (Admin/HR/KeToan) ===== */
var WRITE_BLOCKED_ = ["AUDIT_LOG", "SYNC_QUEUE", "DRIVE_FILES"];

function checkWrite_(sheetName, sess) {
  if (WRITE_BLOCKED_.indexOf(sheetName) >= 0) throw new Error("Bang " + sheetName + " chi ghi tu dong, khong sua tay");
  if (READABLE_TABLES_.indexOf(sheetName) < 0) throw new Error("Bang khong duoc phep: " + sheetName);
  if (sess.role === "NHAN_VIEN") throw new Error("Khong co quyen ghi");
  if (sheetName === "TAI_KHOAN" && sess.role !== "MASTER_ADMIN") throw new Error("Chi Admin duoc sua TAI_KHOAN");
}

/** Them dong (cot ID trong -> tu sinh UUID) */
function createRow(sheetName, values, token) {
  var sess = verifyToken_(token);
  checkWrite_(sheetName, sess);
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, sheetName);
  var headers = sh.getLastRow() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  var row = [];
  for (var i = 0; i < sh.getLastColumn(); i++) row.push(values && values[i] !== undefined ? values[i] : "");
  if (headers.length && String(headers[0]).toUpperCase() === "ID" && !row[0]) row[0] = Utilities.getUuid();
  sh.appendRow(row);
  logAudit_(sess.username || sess.maNV || sess.role, "CREATE_ROW", sheetName, "", row.slice(0, 3).join("|"));
  return { success: true };
}

/** Sua dong theo so dong Sheet (rowNum >= 2). values: mang du cot (o trong giu nguyen). */
function updateRow(sheetName, rowNum, values, token) {
  var sess = verifyToken_(token);
  checkWrite_(sheetName, sess);
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, sheetName);
  rowNum = Number(rowNum);
  if (!(rowNum >= 2) || rowNum > sh.getLastRow()) throw new Error("Dong khong ton tai: " + rowNum);
  var nCol = sh.getLastColumn();
  var cur = sh.getRange(rowNum, 1, 1, nCol).getValues()[0];
  var before = cur.slice(0, 3).join("|");
  for (var i = 0; i < nCol; i++) {
    if (values && values[i] !== undefined && values[i] !== "") cur[i] = values[i];
  }
  sh.getRange(rowNum, 1, 1, nCol).setValues([cur]);
  logAudit_(sess.username || sess.maNV || sess.role, "UPDATE_ROW", sheetName, before, cur.slice(0, 3).join("|"));
  return { success: true, row: rowNum };
}

/** Xoa dong theo so dong Sheet (rowNum >= 2) */
function deleteRow(sheetName, rowNum, token) {
  var sess = verifyToken_(token);
  checkWrite_(sheetName, sess);
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, sheetName);
  rowNum = Number(rowNum);
  if (!(rowNum >= 2) || rowNum > sh.getLastRow()) throw new Error("Dong khong ton tai: " + rowNum);
  var cur = sh.getRange(rowNum, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.deleteRow(rowNum);
  logAudit_(sess.username || sess.maNV || sess.role, "DELETE_ROW", sheetName, cur.slice(0, 3).join("|"), "");
  return { success: true };
}
