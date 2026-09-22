/**
 * OfficialService.gs — Demo Nhan Su V1.0.0 (G4)
 * Chinh thuc: dky 2 OFF/tuan -> lich T2-CN -> doi ca -> luong.
 * Phu thuoc: Config.gs, Database.gs (getMainSpreadsheet),
 * SyncService.gs (getSheetByIds_, logAudit_).
 */

var CA_HOURS_ = { "SANG": 5, "TRUA": 6, "CHIEU": 6, "TOI": 5 };
var OFFICIAL_RATE_ = 25500;

function findOfficialByMaNV_(maNV) {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "NHAN_VIEN_CHINH_THUC");
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][1]) === String(maNV)) return { sheet: sh, row: i + 1, data: vals[i] };
  }
  throw new Error("Khong tim thay Ma NV Chinh thuc: " + maNV);
}

function caHours_(caText) {
  var t = String(caText || "").toLowerCase();
  if (t.indexOf("7g00") >= 0 || t.indexOf("sang") >= 0) return 5;
  if (t.indexOf("12g00") >= 0 || t.indexOf("chieu") >= 0 || t.indexOf("trua") >= 0) return 6;
  if (t.indexOf("18g00") >= 0 || t.indexOf("toi") >= 0) return 5;
  return 5;
}

function mondayOf_(d) {
  var t = new Date(d); var day = (t.getDay() + 6) % 7; // T2=0
  t.setDate(t.getDate() - day); t.setHours(0, 0, 0, 0);
  return t;
}

/**
 * B1: dang ky 2 OFF/tuan (tuan tinh tu T2). offDates: 2 ngay 'yyyy-MM-dd' trong tuan.
 * -> ghi PHIEU_OFF_HANG_TUAN + sinh 7 dong LICH_LAM_VIEC (OFF/LAM).
 */
function registerWeeklyOff(maNV, tuanBatDau, offDates) {
  var f = findOfficialByMaNV_(maNV);
  var mon = mondayOf_(tuanBatDau);
  var sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  if (!offDates || offDates.length !== 2) throw new Error("Phai dang ky dung 2 ngay OFF/tuan");
  var k1 = fmtDate_(offDates[0]), k2 = fmtDate_(offDates[1]);
  if (k1 === k2) throw new Error("Trung ngay OFF");
  [k1, k2].forEach(function (k) {
    var t = new Date(k); t.setHours(0, 0, 0, 0);
    if (t < mon || t > sun) throw new Error("Ngay OFF ngoai tuan " + fmtDate_(mon));
  });

  var ss = getMainSpreadsheet();
  var offSh = ss.getSheetByName("PHIEU_OFF_HANG_TUAN");
  var ten = f.data[2], cn = f.data[5], ca = f.data[6];
  var now = new Date();
  [k1, k2].forEach(function (k) {
    offSh.appendRow([Utilities.getUuid(), maNV, ten, cn, ca, new Date(k),
      "HANG_TUAN", "APPROVED", "TRUE", now]);
  });

  var lichSh = ss.getSheetByName("LICH_LAM_VIEC");
  var vals = lichSh.getLastRow() > 1 ? lichSh.getDataRange().getValues() : [[]];
  var del = [];
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][1]) === String(maNV) && fmtDate_(vals[i][5]) >= fmtDate_(mon) && fmtDate_(vals[i][5]) <= fmtDate_(sun)) del.push(i + 1);
  }
  del.reverse().forEach(function (r) { lichSh.deleteRow(r); });

  var offSet = {}; offSet[k1] = true; offSet[k2] = true;
  for (var d = new Date(mon); d <= sun; d.setDate(d.getDate() + 1)) {
    var key = fmtDate_(d);
    var isOff = !!offSet[key];
    lichSh.appendRow([Utilities.getUuid(), maNV, ten, cn, fmtDate_(mon), new Date(d),
      weekdayVN_(d), isOff ? "OFF" : ca, isOff ? "OFF_OFFICIAL" : "LICH_LAM", "", 1]);
  }
  logAudit_(maNV, "REGISTER_2_OFF", "PHIEU_OFF_HANG_TUAN", maNV, k1 + "," + k2);
  return { success: true, maNV: maNV, tuan: fmtDate_(mon), off: [k1, k2] };
}

/** B2: xem lich tuan (tra ve mang dong LICH_LAM_VIEC) */
function getWeeklySchedule(maNV, tuanBatDau) {
  var mon = mondayOf_(tuanBatDau);
  var sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "LICH_LAM_VIEC");
  if (sh.getLastRow() < 2) return [];
  var vals = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][1]) !== String(maNV)) continue;
    var ng = fmtDate_(vals[i][5]);
    if (ng >= fmtDate_(mon) && ng <= fmtDate_(sun)) {
      out.push({ ngay: ng, thu: vals[i][6], ca: vals[i][7], trangThai: vals[i][8], nguoiThay: vals[i][9] });
    }
  }
  return out;
}

/**
 * B3: tao phieu doi ca. Gate: moi NV chi 1 phieu PENDING.
 */
function requestShiftSwap(maNV, ngay, caCu, caMoi, nvThayCa, lyDo) {
  var f = findOfficialByMaNV_(maNV);
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "PHIEU_DOI_CA_OFFICIAL");
  if (sh.getLastRow() > 1) {
    var vals = sh.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][1]) === String(maNV) && String(vals[i][8]) === "PENDING") {
        throw new Error("NV dang co 1 phieu PENDING, khong tao them");
      }
    }
  }
  var id = Utilities.getUuid();
  sh.appendRow([id, maNV, f.data[2], new Date(ngay), caCu, caMoi, nvThayCa || "", lyDo || "", "PENDING", new Date(), ""]);
  logAudit_(maNV, "REQUEST_DOI_CA", "PHIEU_DOI_CA_OFFICIAL", maNV, id);
  return { success: true, phieuId: id };
}

/** B3b: HR duyet phieu. duyet=true -> HR_APPROVED + cap nhat LICH_LAM_VIEC. */
function approveShiftSwap(phieuId, nguoiDuyet, duyet) {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "PHIEU_DOI_CA_OFFICIAL");
  var vals = sh.getDataRange().getValues();
  var found = null, row = -1;
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(phieuId)) { found = vals[i]; row = i + 1; break; }
  }
  if (!found) throw new Error("Khong tim thay phieu: " + phieuId);
  var st = duyet ? "HR_APPROVED" : "HR_REJECTED";
  sh.getRange(row, 9).setValue(st);
  sh.getRange(row, 11).setValue(nguoiDuyet || "HR");
  if (duyet) {
    var lichSh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "LICH_LAM_VIEC");
    var lv = lichSh.getDataRange().getValues();
    var target = fmtDate_(found[3]);
    for (var j = 1; j < lv.length; j++) {
      if (String(lv[j][1]) === String(found[1]) && fmtDate_(lv[j][5]) === target) {
        lichSh.getRange(j + 1, 8).setValue(found[5]); // Ca moi
        if (found[6]) lichSh.getRange(j + 1, 10).setValue(found[6]);
        break;
      }
    }
  }
  logAudit_(nguoiDuyet || "HR", "APPROVE_DOI_CA", "PHIEU_DOI_CA_OFFICIAL", phieuId, st);
  return { success: true, phieuId: phieuId, trangThai: st };
}

/**
 * B4: tinh luong chinh thuc theo thang 'yyyy-MM'.
 * Don gia 25.5k/h; gio theo ca (Sang 5 / Chieu 6 / Toi 5).
 * Ghi/dong bo BAO_CAO_CHAM_CONG.
 */
function calculateOfficialSalary(maNV, thang) {
  var f = findOfficialByMaNV_(maNV);
  var m = String(thang).match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error("thang phai dang yyyy-MM");
  var recSh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "RECORD_DIEM_DANH");
  var soCa = 0, tongGio = 0;
  if (recSh.getLastRow() > 1) {
    var vals = recSh.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][1]) !== String(maNV)) continue;
      var ng = vals[i][3] instanceof Date ? Utilities.formatDate(new Date(vals[i][3]), "Asia/Ho_Chi_Minh", "yyyy-MM") : String(vals[i][3]).substring(0, 7);
      if (ng !== thang) continue;
      if (String(vals[i][14]) === "COMPLETED") {
        soCa++;
        tongGio += caHours_(vals[i][4]);
      }
    }
  }
  var luong = tongGio * OFFICIAL_RATE_;
  var bcSh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "BAO_CAO_CHAM_CONG");
  var bvals = bcSh.getLastRow() > 1 ? bcSh.getDataRange().getValues() : [[]];
  var updated = false;
  for (var j = 1; j < bvals.length; j++) {
    if (String(bvals[j][0]) === String(maNV) && String(bvals[j][3]) === thang) {
      bcSh.getRange(j + 1, 6).setValue(soCa);
      bcSh.getRange(j + 1, 7).setValue(luong);
      bcSh.getRange(j + 1, 15).setValue("DA_TINH");
      updated = true;
      break;
    }
  }
  if (!updated) {
    bcSh.appendRow([maNV, f.data[2], f.data[5], thang, 26, soCa, luong, 0, tongGio, tongGio, 0, 0, 0, 0, "DA_TINH"]);
  }
  logAudit_("KETOAN", "TINH_LUONG_OFFICIAL", "BAO_CAO_CHAM_CONG", maNV, thang + "=" + luong);
  return { success: true, maNV: maNV, thang: thang, soCa: soCa, tongGio: tongGio, donGia: OFFICIAL_RATE_, luong: luong };
}

/** Admin kich hoat SDT nhan vien Chinh thuc (Trang thai -> DA_DUYET, Dong bo -> TRUE) */
function approveOfficialPhone(maNV) {
  var f = findOfficialByMaNV_(maNV);
  f.sheet.getRange(f.row, 9).setValue("DA_DUYET");
  f.sheet.getRange(f.row, 15).setValue("TRUE");
  logAudit_("ADMIN", "APPROVE_OFFICIAL_PHONE", "NHAN_VIEN_CHINH_THUC", maNV, "DA_DUYET");
  return { success: true, maNV: maNV, trangThai: "DA_DUYET" };
}
