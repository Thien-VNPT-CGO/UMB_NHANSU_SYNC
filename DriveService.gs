/**
 * DriveService.gs — Demo Nhan Su V1.0.0 (luu anh diem danh len Drive)
 * uploadPhoto(maNV, kind, base64, mimeType) -> {url, fileId, fileName}
 * + ghi dong DRIVE_FILES. Thu muc: ROOT/MaNV/yyyy-MM-dd/.
 * Phu thuoc: Config.gs, SyncService.gs (getSheetByIds_, logAudit_).
 */

function driveFolder_(id) {
  return DriveApp.getFolderById(id);
}

function subFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function findNameByMaNV_(maNV) {
  var ss = getMainSpreadsheet();
  var tables = ["NHAN_VIEN_TRAINING", "NHAN_VIEN_CHINH_THUC", "NHAN_VIEN_XUONG", "NHAN_VIEN_VAN_PHONG", "NHAN_VIEN_SALE"];
  for (var t = 0; t < tables.length; t++) {
    var sh = ss.getSheetByName(tables[t]);
    if (!sh || sh.getLastRow() < 2) continue;
    var vals = sh.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][1]) === String(maNV)) return String(vals[i][2]);
    }
  }
  return "";
}

/** base64: nhan cả dataURL lan raw. mimeType vd image/jpeg. */
function uploadPhoto(maNV, kind, base64, mimeType) {
  if (!maNV) throw new Error("Thieu Ma NV");
  if (!base64) throw new Error("Thieu anh");
  var clean = String(base64);
  if (clean.indexOf(",") >= 0) clean = clean.split(",").slice(1).join(",");
  var bytes = Utilities.base64Decode(clean);
  var mime = mimeType || "image/jpeg";
  var ext = mime.indexOf("png") >= 0 ? "png" : "jpg";
  var day = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
  var ts = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "HHmmss");
  var fileName = maNV + "-" + kind + "-" + day + "-" + ts + "." + ext;
  var root = driveFolder_(CONFIG.ATTENDANCE_DRIVE_FOLDER_ID);
  var folder = subFolder_(subFolder_(root, maNV), day);
  var blob = Utilities.newBlob(bytes, mime, fileName);
  var file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  var url = "https://drive.google.com/file/d/" + file.getId() + "/view";
  getSheetByIds_(CONFIG.SPREADSHEET_ID, "DRIVE_FILES").appendRow([
    Utilities.getUuid(), maNV, findNameByMaNV_(maNV), new Date(),
    "DIEM_DANH_" + kind, fileName, maNV + "/" + day, url, new Date()
  ]);
  logAudit_(maNV, "UPLOAD_PHOTO", "DRIVE_FILES", maNV, fileName);
  return { success: true, url: url, fileId: file.getId(), fileName: fileName };
}
