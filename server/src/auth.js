"use strict";
/** auth.js — login 3 loai tren Sheet (map 1-1 AuthService.gs) */
const crypto = require("node:crypto");
const config = require("./config");
const sheets = require("./sheets");
const sessions = require("./sessions");

function sha256(s) { return crypto.createHash("sha256").update(String(s || "")).digest("hex"); }
const digits = (s) => String(s || "").replace(/\D/g, "");
const norm = (s) => String(s || "").toLowerCase();

async function loginAdmin(username, password) {
  if (String(username) !== config.adminUser || String(password) !== config.adminPass) throw new Error("Sai tai khoan Admin");
  const s = sessions.create("MST-", { role: "MASTER_ADMIN", username: "admin", branch: "ALL", tabs: "ALL" });
  await audit("ADMIN", "LOGIN", "TAI_KHOAN", "admin", "OK").catch(() => {});
  return { success: true, token: s.token, role: s.role, username: "admin" };
}

async function loginInternal(username, pin) {
  await sheets.ensureTable(config.mainSheetId, "TAI_KHOAN");
  const t = await sheets.readTable(config.mainSheetId, "TAI_KHOAN");
  const key = norm(username), keyPhone = digits(username);
  for (let i = 0; i < t.rows.length; i++) {
    const r = t.rows[i];
    const gmail = norm(r[1]), phone = digits(r[3]);
    if (gmail !== key && !(keyPhone && phone === keyPhone)) continue;
    if (String(r[4]) !== "ACTIVE") throw new Error("Tai khoan bi khoa");
    let stored = String(r[6] || "");
    if (!stored) {
      const firstPin = String(pin || "123456");
      await sheets.updateRow(config.mainSheetId, "TAI_KHOAN", t.rowNums[i], [...Array(6).fill(""), firstPin]);
      stored = firstPin;
      if (!pin) throw new Error("Tai khoan moi: hay dang nhap lai voi PIN vua duoc cap (mac dinh 123456, doi ngay sau khi vao)");
    }
    if (String(pin) !== stored) throw new Error("Sai PIN");
    const s = sessions.create("HR-", { role: String(r[5]), username: String(r[1]), ten: String(r[2]), branch: "ALL", tabs: "" });
    await audit(username, "LOGIN", "TAI_KHOAN", username, s.role).catch(() => {});
    return { success: true, token: s.token, role: s.role, branch: s.branch, tabs: s.tabs, ten: s.ten };
  }
  throw new Error("Khong tim thay tai khoan: " + username);
}

const NV_TARGETS = [
  { name: "NHAN_VIEN_TRAINING", loai: "TRAINING", stIdx: 10, ok: ["DA_DUYET", "DANG_TRAINING"] },
  { name: "NHAN_VIEN_CHINH_THUC", loai: "CHINH_THUC", stIdx: 8, ok: ["DA_DUYET"] },
  { name: "NHAN_VIEN_XUONG", loai: "XUONG", stIdx: 5, ok: ["DA_DUYET", "ACTIVE"] },
  { name: "NHAN_VIEN_VAN_PHONG", loai: "VAN_PHONG", stIdx: 5, ok: ["DA_DUYET", "ACTIVE"] },
  { name: "NHAN_VIEN_SALE", loai: "SALE", stIdx: 5, ok: ["DA_DUYET", "ACTIVE"] },
];

async function loginEmployee(sdt) {
  const phone = digits(sdt);
  if (!phone) throw new Error("Thieu SDT");
  for (const tg of NV_TARGETS) {
    const t = await sheets.readTable(config.mainSheetId, tg.name);
    for (let i = 0; i < t.rows.length; i++) {
      if (digits(t.rows[i][3]) !== phone) continue;
      const st = String(t.rows[i][tg.stIdx] || "");
      if (!tg.ok.includes(st)) throw new Error("SDT chua duoc kich hoat (trang thai: " + st + "). Lien he Admin.");
      const s = sessions.create("NV-", { role: "NHAN_VIEN", loai: tg.loai, maNV: String(t.rows[i][1]), ten: String(t.rows[i][2]), sdt: phone });
      await audit(s.maNV, "LOGIN", tg.name, phone, "OK").catch(() => {});
      return { success: true, token: s.token, loai: s.loai, maNV: s.maNV, ten: s.ten };
    }
  }
  throw new Error("SDT [" + phone + "] chua co trong he thong. Lien he Admin kich hoat.");
}

async function createInternalAccount(payload, sess) {
  if (sess.role !== "MASTER_ADMIN") throw new Error("Chi Admin duoc cap tai khoan");
  const gmail = norm(payload.gmail);
  if (!gmail) throw new Error("Thieu GMAIL");
  const t = await sheets.readTable(config.mainSheetId, "TAI_KHOAN");
  if (t.rows.some((r) => norm(r[1]) === gmail)) throw new Error("GMAIL da ton tai");
  const pin = String(payload.pin || Math.floor(100000 + Math.random() * 900000));
  const id = "TK-" + crypto.randomUUID().substring(0, 8).toUpperCase();
  await sheets.appendRow(config.mainSheetId, "TAI_KHOAN", [id, gmail, payload.hoten || gmail, payload.sdt || "", "ACTIVE", payload.role || "HR", pin, new Date()]);
  await audit(sess.username, "CREATE_ACCOUNT", "TAI_KHOAN", gmail, payload.role).catch(() => {});
  return { success: true, gmail, pin };
}

async function listAccounts(sess) {
  if (sess.role !== "MASTER_ADMIN" && sess.role !== "HR") throw new Error("Khong co quyen");
  const t = await sheets.readTable(config.mainSheetId, "TAI_KHOAN");
  return t.rows.map((r) => ({ id: r[0], gmail: r[1], hoten: r[2], sdt: r[3], trangThai: r[4], phanQuyen: r[5], ngayTao: r[7] }));
}

async function audit(actor, action, entity, before, after) {
  const id = crypto.randomUUID();
  await sheets.appendRow(config.mainSheetId, "AUDIT_LOG", [id, actor, action, entity, String(before).substring(0, 4000), String(after).substring(0, 4000), new Date(), ""]);
}

module.exports = { sha256, loginAdmin, loginInternal, loginEmployee, createInternalAccount, listAccounts, audit };
