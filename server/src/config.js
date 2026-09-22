"use strict";
require("dotenv").config();

function need(name, fallback) {
  const v = process.env[name] !== undefined && process.env[name] !== "" ? process.env[name] : fallback;
  if (v === undefined) throw new Error("Thieu bien moi truong " + name);
  return v;
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  mainSheetId: need("MAIN_SHEET_ID", "17iXM0zc1m17aX9AZrFMjOkPRMy2_CwWfjTRZSUPQF2w"),
  formSheetId: need("FORM_SHEET_ID", "1rcqEKraSRhr-Tn9qwlhADlkQUei8j65bXeHF_Tmkd38"),
  serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "",
  serviceAccountFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "./service-account.json",
  adminUser: need("ADMIN_USER", "admin"),
  adminPass: need("ADMIN_PASS", "Nguyenthanhthien@160200"),
  sessionTtlMs: (Number(process.env.SESSION_TTL_HOURS) || 24) * 3600000,
  corsOrigin: process.env.CORS_ORIGIN || "*",
};
