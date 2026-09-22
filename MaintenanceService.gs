/**
 * MaintenanceService.gs — Demo Nhan Su V1.0.0 (bao tri doc lap tung tab)
 * Luu map {tabKey: {off, lyDo, moLai}} trong ScriptProperties MAINTENANCE_MAP.
 * Frontend goi getMaintenance luc load de an/hien tab. Backend chan action
 * co payload.tab dang bao tri (xem Code.gs).
 */

var MAINT_TABS_ = ["hr_moi", "hr_pv", "hr_training", "hr_test",
  "kt_luong", "kt_baocao",
  "nv_lich", "nv_diemdanh", "nv_off", "nv_doi"];

function getMaintMap_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty("MAINTENANCE_MAP");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

/** Public: frontend goi de ve banner / an tab */
function getMaintenance() {
  return { success: true, tabs: MAINT_TABS_, off: getMaintMap_() };
}

function isTabOff_(tabKey) {
  var m = getMaintMap_();
  return !!(m[tabKey] && m[tabKey].off);
}

/** Admin bat/tat bao tri 1 tab */
function setMaintenance(tabKey, off, lyDo, moLai, token) {
  var sess = verifyToken_(token);
  if (sess.role !== "MASTER_ADMIN") throw new Error("Chi Admin duoc bao tri tab");
  if (MAINT_TABS_.indexOf(tabKey) < 0) throw new Error("Tab khong ton tai: " + tabKey);
  var m = getMaintMap_();
  m[tabKey] = { off: !!off, lyDo: lyDo || "", moLai: moLai || "", by: sess.username, at: new Date().toISOString() };
  try {
    PropertiesService.getScriptProperties().setProperty("MAINTENANCE_MAP", JSON.stringify(m));
  } catch (e) { throw new Error("Khong luu duoc cau hinh bao tri"); }
  logAudit_(sess.username, "MAINTENANCE_TAB", "SYSTEM", tabKey, (off ? "OFF" : "ON") + "|" + (lyDo || ""));
  return { success: true, tab: tabKey, off: !!off };
}
