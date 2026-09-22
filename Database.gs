/**
 * Database.gs — Demo Nhan Su V1.0.0 (G0)
 * Chuan duy nhat: Sheet UMB_NHANSU_SYNC 17iXM0zc1m17aX9AZrFMjOkPRMy2_CwWfjTRZSUPQF2w
 * 24 sheets, header Tieng Viet khong dau (de tranh loi font Apps Script),
 * nhung giu mapping ten hien thi Tieng Viet day du trong DISPLAY_NAMES.
 */

var MAIN_SPREADSHEET_ID = "17iXM0zc1m17aX9AZrFMjOkPRMy2_CwWfjTRZSUPQF2w";
var CANDIDATE_FORM_SHEET_ID = "1rcqEKraSRhr-Tn9qwlhADlkQUei8j65bXeHF_Tmkd38";

/* Header chuan (khong dau) — thu tu cot = Sheet that (quet ngay 2026-09-21) */
var DB_SCHEMAS = {
  "NHAN_VIEN_MOI": ["ID","Ngay DK","Ho ten","Gioi tinh","Nam sinh","Trinh do","Que quan","SDT","Ca dang ky","Chi nhanh DK","Kinh nghiem","Xu ly dot xuat","Facebook","Nguon biet tin","Diem AI","Ket qua","Trang thai","Ma nguon","Phien ban","Cap nhat luc"],
  "CHAM_CONG": ["MaNV","Ngay","CheckIn","CheckOut","GPS","AnhDriveURL","TrePhut","Phat","GhiChu"],
  "NHAN_VIEN_TRAINING": ["ID","Ma NV","Ho ten","SDT","Khoa","Chi nhanh","Ca","Ngay bat dau","Ngay ket thuc","So ngay Thu viec","Trang thai","Diem TEST","Ket qua TEST","Loai","Nhom","Phien ban","Cap nhat luc","Dong bo"],
  "NHAN_VIEN_CHINH_THUC": ["ID","Ma NV","Ho ten","SDT","Khoa","Chi nhanh","Ca","Ngay bat dau","Trang thai","Diem TEST","Loai","Ngay chinh thuc","Phien ban","Cap nhat luc","Dong bo"],
  "PHIEU_DOI_CA_TRAINING": ["ID","Ma NV","Ho ten","Ngay","Ca cu","Ca moi","Ly do","Trang thai","Ngay tao","Het han","Nguoi duyet"],
  "LICH_LAM_VIEC": ["ID","Ma NV","Ho ten","Chi nhanh","Tuan bat dau","Ngay","Thu","Ca","Trang thai","Nguoi thay","Phien ban"],
  "NHAN_VIEN_XUONG": ["ID","Ma NV","Ho ten","SDT","Chi nhanh","Trang thai","Dong bo"],
  "NHAN_VIEN_VAN_PHONG": ["ID","Ma NV","Ho ten","SDT","Chi nhanh","Trang thai","Dong bo"],
  "NHAN_VIEN_SALE": ["ID","Ma NV","Ho ten","SDT","Chi nhanh","Trang thai","Dong bo"],
  "PHIEU_OFF_DOT_XUAT": ["ID","Ma NV","Ho ten","Chi nhanh","Ca","Ngay OFF","Ly do","Nguoi thay","Trang thai","Buoc lien hoan","Ngay tao"],
  "PHIEU_OFF_HANG_TUAN": ["ID","Ma NV","Ho ten","Chi nhanh","Ca","Ngay OFF","Loai","Trang thai","Tu dong duyet","Ngay tao"],
  "RECORD_DIEM_DANH": ["ID","Ma NV","Ho ten","Ngay","Ca","Chi nhanh","Gio vao ca","GPS vao","Anh vao","Drive vao","Gio ra ca","GPS ra","Anh ra","Drive ra","Trang thai","Vi pham","Phien ban"],
  "BAO_CAO_CHAM_CONG": ["Ma NV","Ho ten","Chi nhanh","Thang","Ngay tieu chuan","Thuc te","Tinh luong","Gio TC","Gio TT","Gio TL","Phep","OT","Tre","Loi","Trang thai"],
  "KHOA_TEST": ["ID","Ten khoa","So cau","Toi thieu/cau","Ngay tao"],
  "KET_QUA_TEST": ["ID","Ma NV","Ho ten","Khoa","Diem","Dung/Tong","Ket qua","Thoi gian lam","Ngay tao"],
  "PHIEU_DOI_CA_OFFICIAL": ["ID","Ma NV","Ho ten","Ngay","Ca cu","Ca moi","NV thay ca","Ly do","Trang thai","Ngay tao","Nguoi duyet"],
  "PHIEU_DOI_THIET_BI": ["ID","Ma NV","Ly do","Thiet bi cu","Thiet bi moi","Trang thai","Ngay tao","Het han"],
  "RECORD_ZALO": ["ID","Thoi gian gui","Nguoi nhan","Loai","Noi dung","Trang thai","Loi"],
  "TAI_KHOAN": ["ID", "GMAIL", "HỌ & TÊN", "SĐT", "TRẠNG THÁI", "PHÂN QUYỀN", "MÃ PIN", "NGÀY TẠO"],
  "AUDIT_LOG": ["ID","Actor","Action","Entity","Before","After","Timestamp","IP"],
  "SYNC_QUEUE": ["ID","Entity","Operation","Version","Updated At","By","Source","Sync Status"],
  "DRIVE_FILES": ["ID","Ma NV","Ho ten","Ngay","Loai","File name","Drive Path","URL","Created At"],
  "LICH_PHONG_VAN": ["Ma ca","Ho va ten","So dien thoai","Thoi gian hen","Link Google Meet","Trang thai xac nhan","Diem AI","Nhan xet AI","Danh gia chung"],
  "LICH_TEST_DAU_RA": ["Ma test","Ho va ten","So dien thoai","Thoi gian hen","Link Meet","Diem cham /10","Nhan xet chi tiet","Xep loai"]
};

function getMainSpreadsheet() {
  var sid = "";
  try {
    sid = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || "";
  } catch (e) {}
  if (!sid) sid = MAIN_SPREADSHEET_ID;
  return SpreadsheetApp.openById(sid);
}

/** G0: tao du 24 sheets + ghi header neu thieu. Chay 1 lan trong Editor. */
function setupFrom17iXM() {
  var ss = getMainSpreadsheet();
  var report = [];
  Object.keys(DB_SCHEMAS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); }
    var headers = DB_SCHEMAS[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      report.push(name + ": CREATED header (" + headers.length + " cot)");
    } else {
      var cur = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      // Patch cac o header trong (truong hop Sheet that bi mat header)
      var patched = 0;
      for (var i = 0; i < headers.length; i++) {
        if (!cur[i] && headers[i]) {
          sh.getRange(1, i + 1).setValue(headers[i]);
          patched++;
        }
      }
      // Mo rong/chuan hoa TAI_KHOAN ve du 8 cot spec (ID/GMAIL/HO & TEN/SDT/TRANG THAI/PHAN QUYEN/MA PIN/NGAY TAO)
      if (sh.getLastColumn() < headers.length) {
        for (var j = sh.getLastColumn(); j < headers.length; j++) {
          sh.getRange(1, j + 1).setValue(headers[j]);
        }
        patched += (headers.length - sh.getLastColumn());
      }
      report.push(name + ": OK (patch " + patched + " o header)");
    }
  });
  // Seed tai khoan Admin mac dinh neu TAI_KHOAN trong
  seedDefaultAccounts_(ss);
  return { success: true, report: report };
}

function seedDefaultAccounts_(ss) {
  var sh = ss.getSheetByName("TAI_KHOAN");
  if (!sh || sh.getLastRow() > 1) return;
  var now = new Date();
  sh.appendRow(["TK-ADMIN-01", "admin@ubm.vn", "Quan tri vien", "", "ACTIVE", "MASTER_ADMIN", "160200", now]);
  sh.appendRow(["TK-HR-01", "hr.tuyendung@ubm.vn", "HR Tuyen dung", "", "ACTIVE", "HR", "123456", now]);
  sh.appendRow(["TK-KT-01", "ketoan.cn1@ubm.vn", "Ke toan CN1", "", "ACTIVE", "KE_TOAN", "123456", now]);
}
