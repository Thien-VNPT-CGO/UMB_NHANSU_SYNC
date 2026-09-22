"use strict";
/** appstate.js — bao tri tab (map MaintenanceService.gs), luu bang _APP_STATE */
const config = require("./config");
const sheets = require("./sheets");

const TABS = ["hr_moi", "hr_pv", "hr_training", "hr_test", "kt_luong", "kt_baocao", "nv_lich", "nv_diemdanh", "nv_off", "nv_doi"];

async function getMap() {
  await sheets.ensureTable(config.mainSheetId, "_APP_STATE");
  const t = await sheets.readTable(config.mainSheetId, "_APP_STATE");
  for (const r of t.rows) {
    if (String(r[0]) === "MAINTENANCE_MAP") {
      try { return JSON.parse(r[1] || "{}"); } catch (e) { return {}; }
    }
  }
  return {};
}

async function saveMap(m) {
  const t = await sheets.readTable(config.mainSheetId, "_APP_STATE");
  const val = JSON.stringify(m);
  for (let i = 0; i < t.rows.length; i++) {
    if (String(t.rows[i][0]) === "MAINTENANCE_MAP") {
      await sheets.updateRow(config.mainSheetId, "_APP_STATE", t.rowNums[i], ["MAINTENANCE_MAP", val, new Date()]);
      return;
    }
  }
  await sheets.appendRow(config.mainSheetId, "_APP_STATE", ["MAINTENANCE_MAP", val, new Date()]);
}

async function getMaintenance() { return { success: true, tabs: TABS, off: await getMap() }; }

async function setMaintenance(tabKey, off, lyDo, sess) {
  if (sess.role !== "MASTER_ADMIN") throw new Error("Chi Admin duoc bao tri tab");
  if (!TABS.includes(tabKey)) throw new Error("Tab khong ton tai: " + tabKey);
  const m = await getMap();
  m[tabKey] = { off: !!off, lyDo: lyDo || "", by: sess.username, at: new Date().toISOString() };
  await saveMap(m);
  return { success: true, tab: tabKey, off: !!off };
}

function isOff(m, tabKey) { return !!(m[tabKey] && m[tabKey].off); }

module.exports = { TABS, getMap, getMaintenance, setMaintenance, isOff };
