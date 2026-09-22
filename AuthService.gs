/**
 * AuthService.gs — Demo Nhan Su V1.0.0
 * Login 3 loai: Admin / Tai khoan noi bo (HR-KT) / Nhan vien (SDT).
 * Session luu 24h: CacheService (toi da 6h) + ScriptProperties (du 24h).
 * Phu thuoc: Config.gs, SyncService.gs (getSheetByIds_, logAudit_).
 */

var SESSION_TTL_SEC_ = 86400; // 24h

function hashPin_(pin) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pin || ""));
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? "0" + v : v; }).join("");
}

function sessPropKey_(token) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token));
  var hex = bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? "0" + v : v; }).join("");
  return "SS" + hex.substring(0, 32);
}

function putSession_(token, obj) {
  obj.exp = Date.now() + SESSION_TTL_SEC_ * 1000;
  var raw = JSON.stringify(obj);
  try {
    CacheService.getScriptCache().put(token, raw, Math.min(SESSION_TTL_SEC_, 21600));
  } catch (e) {}
  try {
    PropertiesService.getScriptProperties().setProperty(sessPropKey_(token), raw);
  } catch (e) {}
  return token;
}

function readSession_(token) {
  var raw = null;
  try { raw = CacheService.getScriptCache().get(token); } catch (e) {}
  if (!raw) {
    try { raw = PropertiesService.getScriptProperties().getProperty(sessPropKey_(token)); } catch (e) {}
  }
  if (!raw) return null;
  try {
    var o = JSON.parse(raw);
    if (o.exp && o.exp < Date.now()) { dropSession_(token); return null; }
    return o;
  } catch (e) { return null; }
}

function dropSession_(token) {
  try { CacheService.getScriptCache().remove(token); } catch (e) {}
  try { PropertiesService.getScriptProperties().deleteProperty(sessPropKey_(token)); } catch (e) {}
}

/** Dang nhap Admin mac dinh theo spec */
function loginAdmin(username, password) {
  if (String(username) !== CONFIG.MASTER_ADMIN_USER || String(password) !== CONFIG.MASTER_ADMIN_PASS) {
    throw new Error("Sai tai khoan Admin");
  }
  var token = "MST-" + Utilities.getUuid();
  putSession_(token, { token: token, role: "MASTER_ADMIN", username: "admin", branch: "ALL", tabs: "ALL", loginAt: new Date().toISOString() });
  logAudit_("ADMIN", "LOGIN", "TAI_KHOAN", "admin", "OK");
  return { success: true, token: token, role: "MASTER_ADMIN", username: "admin" };
}

/** Dang nhap HR / Ke toan bang Username + PIN (PIN hash trong TAI_KHOAN) */
function loginInternal(username, pin) {
  ensureTaiKhoanSchema_();
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "TAI_KHOAN");
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    var gmail = String(vals[i][1] || "").toLowerCase();
    var phone = String(vals[i][3] || "").replace(/\D/g, "");
    var key = String(username || "").toLowerCase();
    var keyPhone = String(username || "").replace(/\D/g, "");
    if (gmail === key || (keyPhone && phone === keyPhone)) {
      if (String(vals[i][4]) !== "ACTIVE") throw new Error("Tai khoan bi khoa");
      var stored = String(vals[i][6] || "");
      if (!stored) {
        // Kich hoat lan dau: nhan PIN hien tai lam PIN chinh thuc
        var firstPin = String(pin || "123456");
        sh.getRange(i + 1, 7).setValue(firstPin);
        stored = firstPin;
        if (String(pin || "") === "") {
          throw new Error("Tai khoan moi: hay dang nhap lai voi PIN vua duoc cap (mac dinh 123456, doi ngay sau khi vao)");
        }
      }
      if (String(pin) !== stored) throw new Error("Sai PIN");
      var token = "HR-" + Utilities.getUuid();
      var sess = { token: token, role: String(vals[i][5]), username: String(vals[i][1]), ten: String(vals[i][2]), branch: "ALL", tabs: "", loginAt: new Date().toISOString() };
      putSession_(token, sess);
      logAudit_(username, "LOGIN", "TAI_KHOAN", username, sess.role);
      return { success: true, token: token, role: sess.role, branch: sess.branch, tabs: sess.tabs, ten: sess.ten };
    }
  }
  throw new Error("Khong tim thay tai khoan: " + username);
}

/** Dang nhap Nhan vien bang SDT (chi khi da duoc kich hoat) */
function loginEmployee(sdt) {
  var phone = String(sdt || "").replace(/\D/g, "");
  if (!phone) throw new Error("Thieu SDT");
  var ss = getMainSpreadsheet();
  var targets = [
    { name: "NHAN_VIEN_TRAINING", loai: "TRAINING", okStates: ["DA_DUYET", "DANG_TRAINING"] },
    { name: "NHAN_VIEN_CHINH_THUC", loai: "CHINH_THUC", okStates: ["DA_DUYET"] },
    { name: "NHAN_VIEN_XUONG", loai: "XUONG", okStates: ["DA_DUYET", "ACTIVE"] },
    { name: "NHAN_VIEN_VAN_PHONG", loai: "VAN_PHONG", okStates: ["DA_DUYET", "ACTIVE"] },
    { name: "NHAN_VIEN_SALE", loai: "SALE", okStates: ["DA_DUYET", "ACTIVE"] }
  ];
  for (var t = 0; t < targets.length; t++) {
    var sh = ss.getSheetByName(targets[t].name);
    if (!sh || sh.getLastRow() < 2) continue;
    var vals = sh.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      var p = String(vals[i][3] || "").replace(/\D/g, "");
      if (p === phone) {
        var st = String(vals[i][10] !== undefined && targets[t].name === "NHAN_VIEN_TRAINING" ? vals[i][10] : vals[i][5]);
        // Cot Trang thai: TRAINING=10, CHINH_THUC=8, XUONG/VP/SALE=5
        var stIdx = targets[t].name === "NHAN_VIEN_TRAINING" ? 10 : (targets[t].name === "NHAN_VIEN_CHINH_THUC" ? 8 : 5);
        st = String(vals[i][stIdx] || "");
        if (targets[t].okStates.indexOf(st) < 0) {
          throw new Error("SDT chua duoc kich hoat (trang thai: " + st + "). Lien he Admin.");
        }
        var token = "NV-" + Utilities.getUuid();
        var sess = { token: token, role: "NHAN_VIEN", loai: targets[t].loai, maNV: String(vals[i][1]), ten: String(vals[i][2]), sdt: phone, loginAt: new Date().toISOString() };
        putSession_(token, sess);
        logAudit_(sess.maNV, "LOGIN", targets[t].name, phone, "OK");
        return { success: true, token: token, loai: sess.loai, maNV: sess.maNV, ten: sess.ten };
      }
    }
  }
  throw new Error("SDT [" + phone + "] chua co trong he thong. Lien he Admin kich hoat.");
}

function verifyToken_(token) {
  if (!token) throw new Error("Thieu token");
  var o = readSession_(token);
  if (!o) throw new Error("Phien het han. Dang nhap lai.");
  return o;
}

function logout(token) {
  dropSession_(token);
  return { success: true };
}

/** Admin tao TK noi bo. pin trong -> random 6 so, tra ve PIN plain 1 lan duy nhat. */
var TAI_KHOAN_SCHEMA_ = ["ID", "GMAIL", "HỌ & TÊN", "SĐT", "TRẠNG THÁI", "PHÂN QUYỀN", "MÃ PIN", "NGÀY TẠO"];
var TAI_KHOAN_ALIAS_ = {
  id: 0, ma: 0,
  gmail: 1, email: 1,
  hoten: 2, tenhienthi: 2, ten: 2, displayname: 2,
  sdt: 3, sodienthoai: 3, phone: 3, dienthoai: 3,
  trangthai: 4, status: 4,
  phanquyen: 5, role: 5, vaitro: 5, chucvu: 5,
  mapin: 6, pin: 6, pinhash: 6, pin_hash: 6, matkhau: 6, password: 6,
  ngaytao: 7, created: 7, ngay: 7
};

function normHeader_(h) {
  var s = String(h || "").toLowerCase().replace(/[dđ]/g, "d").replace(/_/g, " ");
  try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
  return s.replace(/[^a-z0-9]/g, "");
}

/**
 * Tu chuan hoa sheet TAI_KHOAN ve dung schema: doi ten cot sai (nhan alias
 * Tieng Viet), sap xep lai dung thu tu, tu sinh cot thieu (rong).
 */
function ensureTaiKhoanSchema_() {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "TAI_KHOAN");
  if (sh.getLastRow() === 0) {
    sh.appendRow(TAI_KHOAN_SCHEMA_);
    return { fixed: true, added: TAI_KHOAN_SCHEMA_.length, renamed: 0 };
  }
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var used = {}, colOf = {};
  for (var c = 0; c < headers.length; c++) {
    var idx = TAI_KHOAN_ALIAS_[normHeader_(headers[c])];
    if (idx !== undefined && !(idx in used)) { used[idx] = true; colOf[idx] = c; }
  }
  var missing = 0;
  for (var s = 0; s < TAI_KHOAN_SCHEMA_.length; s++) if (!(s in colOf)) missing++;
  var needReorder = lastCol !== TAI_KHOAN_SCHEMA_.length;
  for (var k = 0; k < TAI_KHOAN_SCHEMA_.length && !needReorder; k++) {
    if (colOf[k] !== k) needReorder = true;
  }
  if (!missing && !needReorder) return { fixed: false };
  var nRows = sh.getLastRow();
  var vals = nRows > 1 ? sh.getRange(2, 1, nRows - 1, lastCol).getValues() : [];
  var renamed = 0;
  for (var j = 0; j < TAI_KHOAN_SCHEMA_.length; j++) {
    if (colOf[j] !== undefined && String(headers[colOf[j]]) !== TAI_KHOAN_SCHEMA_[j]) renamed++;
  }
  sh.clearContents();
  sh.getRange(1, 1, 1, TAI_KHOAN_SCHEMA_.length).setValues([TAI_KHOAN_SCHEMA_]);
  var out = vals.map(function (row) {
    return TAI_KHOAN_SCHEMA_.map(function (_, j) { return colOf[j] !== undefined ? row[colOf[j]] : ""; });
  });
  if (out.length) sh.getRange(2, 1, out.length, TAI_KHOAN_SCHEMA_.length).setValues(out);
  var res = { fixed: true, added: missing, renamed: renamed, reordered: needReorder };
  logAudit_("SYSTEM", "FIX_TAI_KHOAN_SCHEMA", "TAI_KHOAN", "", JSON.stringify(res));
  return res;
}

function createInternalAccount(payload, token) {
  var sess = verifyToken_(token);
  if (sess.role !== "MASTER_ADMIN") throw new Error("Chi Admin duoc cap tai khoan");
  var schemaFix = ensureTaiKhoanSchema_();
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "TAI_KHOAN");
  var gmail = String(payload.gmail || "").toLowerCase();
  if (!gmail) throw new Error("Thieu GMAIL");
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][1]).toLowerCase() === gmail) throw new Error("GMAIL da ton tai");
  }
  var pin = String(payload.pin || Math.floor(100000 + Math.random() * 900000));
  sh.appendRow(["TK-" + Utilities.getUuid().substring(0, 8).toUpperCase(),
    gmail, payload.hoten || gmail, payload.sdt || "", "ACTIVE",
    payload.role || "HR", pin, new Date()]);
  logAudit_(sess.username, "CREATE_ACCOUNT", "TAI_KHOAN", gmail, payload.role);
  return { success: true, gmail: gmail, pin: pin, schemaFix: schemaFix };
}

function listAccounts(token) {
  var sess = verifyToken_(token);
  if (sess.role !== "MASTER_ADMIN" && sess.role !== "HR") throw new Error("Khong co quyen");
  ensureTaiKhoanSchema_();
  var vals = getSheetByIds_(CONFIG.SPREADSHEET_ID, "TAI_KHOAN").getDataRange().getValues();
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    out.push({ id: vals[i][0], gmail: vals[i][1], hoten: vals[i][2], sdt: vals[i][3], trangThai: vals[i][4], phanQuyen: vals[i][5], ngayTao: vals[i][7] instanceof Date ? vals[i][7].toISOString() : vals[i][7] });
  }
  return out;
}
