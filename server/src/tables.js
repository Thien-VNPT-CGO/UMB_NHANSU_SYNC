"use strict";
/** tables.js — doc/ghi bang + dashboard (map DataService.gs). An cot MA PIN (idx 6). */
const config = require("./config");
const sheets = require("./sheets");
const auth = require("./auth");

const READABLE = ["NHAN_VIEN_MOI", "NHAN_VIEN_TRAINING", "NHAN_VIEN_CHINH_THUC", "NHAN_VIEN_XUONG", "NHAN_VIEN_VAN_PHONG", "NHAN_VIEN_SALE", "LICH_PHONG_VAN", "LICH_TEST_DAU_RA", "LICH_LAM_VIEC", "RECORD_DIEM_DANH", "CHAM_CONG", "PHIEU_OFF_HANG_TUAN", "PHIEU_OFF_DOT_XUAT", "PHIEU_DOI_CA_OFFICIAL", "PHIEU_DOI_CA_TRAINING", "KHOA_TEST", "KET_QUA_TEST", "BAO_CAO_CHAM_CONG", "TAI_KHOAN", "AUDIT_LOG", "RECORD_ZALO", "SYNC_QUEUE"];
const WRITE_BLOCKED = ["AUDIT_LOG", "SYNC_QUEUE", "DRIVE_FILES"];
const digits = (s) => String(s || "").replace(/\D/g, "");

async function listTable(sheetName, opts, sess) {
  if (!READABLE.includes(sheetName)) throw new Error("Bang khong duoc phep doc: " + sheetName);
  opts = opts || {};
  const t = await sheets.readTable(config.mainSheetId, sheetName);
  const hideIdx = sheetName === "TAI_KHOAN" ? 6 : -1;
  const q = String(opts.search || "").toLowerCase();
  const rows = [], rowNums = [];
  t.rows.forEach((r, i) => {
    if (sess.role === "NHAN_VIEN") {
      let mine = false;
      for (let c = 0; c < r.length; c++) {
        const h = t.headers[c].toLowerCase();
        if ((h.includes("sdt") || h.includes("dien thoai")) && digits(r[c]) === sess.sdt) { mine = true; break; }
        if ((h === "ma nv" || h === "ma ca" || h === "ma test") && String(r[c]) === sess.maNV) { mine = true; break; }
      }
      if (!mine) return;
    }
    if (opts.statusCol != null && String(r[opts.statusCol]) !== String(opts.statusVal)) return;
    if (q && !r.join(" ").toLowerCase().includes(q)) return;
    const row = r.map((v) => (v instanceof Date ? v.toISOString() : v));
    if (hideIdx >= 0) row[hideIdx] = "***";
    rows.push(row);
    rowNums.push(t.rowNums[i]);
  });
  const offset = opts.offset || 0, limit = opts.limit || 100;
  return { headers: t.headers, rows: rows.slice(offset, offset + limit), rowNums: rowNums.slice(offset, offset + limit), total: rows.length };
}

function checkWrite(sheetName, sess) {
  if (WRITE_BLOCKED.includes(sheetName)) throw new Error("Bang " + sheetName + " chi ghi tu dong, khong sua tay");
  if (!READABLE.includes(sheetName)) throw new Error("Bang khong duoc phep: " + sheetName);
  if (sess.role === "NHAN_VIEN") throw new Error("Khong co quyen ghi");
  if (sheetName === "TAI_KHOAN" && sess.role !== "MASTER_ADMIN") throw new Error("Chi Admin duoc sua TAI_KHOAN");
}

async function createRow(sheetName, values, sess) {
  checkWrite(sheetName, sess);
  const t = await sheets.readTable(config.mainSheetId, sheetName);
  const row = [];
  for (let i = 0; i < Math.max(t.headers.length, (values || []).length); i++) row.push(values && values[i] !== undefined ? values[i] : "");
  if (t.headers.length && String(t.headers[0]).toUpperCase() === "ID" && !row[0]) row[0] = require("node:crypto").randomUUID();
  const r = await sheets.appendRow(config.mainSheetId, sheetName, row);
  await auth.audit(sess.username || sess.maNV || sess.role, "CREATE_ROW", sheetName, "", row.slice(0, 3).join("|")).catch(() => {});
  return { success: true, row: r.row };
}

async function updateRow(sheetName, rowNum, values, sess) {
  checkWrite(sheetName, sess);
  const r = await sheets.updateRow(config.mainSheetId, sheetName, Number(rowNum), values);
  await auth.audit(sess.username || sess.maNV || sess.role, "UPDATE_ROW", sheetName, r.before, "").catch(() => {});
  return { success: true, row: Number(rowNum) };
}

async function deleteRow(sheetName, rowNum, sess) {
  checkWrite(sheetName, sess);
  await sheets.deleteRow(config.mainSheetId, sheetName, Number(rowNum));
  await auth.audit(sess.username || sess.maNV || sess.role, "DELETE_ROW", sheetName, sheetName + "#" + rowNum, "").catch(() => {});
  return { success: true };
}

async function dashboard() {
  const count = async (name, colIdx, val) => {
    const t = await sheets.readTable(config.mainSheetId, name);
    if (colIdx == null) return t.rows.length;
    return t.rows.filter((r) => String(r[colIdx]) === val).length;
  };
  return {
    success: true,
    moiNew: await count("NHAN_VIEN_MOI", 16, "NEW_APPLICANT"),
    moiRejected: await count("NHAN_VIEN_MOI", 16, "REJECTED"),
    training: await count("NHAN_VIEN_TRAINING"),
    chinhThuc: await count("NHAN_VIEN_CHINH_THUC"),
    swapPending: await count("PHIEU_DOI_CA_OFFICIAL", 8, "PENDING"),
    pvCho: await count("LICH_PHONG_VAN", 5, "CHO_XAC_NHAN"),
  };
}

module.exports = { listTable, createRow, updateRow, deleteRow, dashboard };
