"use strict";
/**
 * sheets.js — Google Sheets API (Service Account) lam DB chinh.
 * Doc/ghi theo VI TRI cot (khong doi ten header that). Ngay Sheets serial <-> ISO.
 */
const fs = require("node:fs");
const { google } = require("googleapis");
const config = require("./config");
const SCHEMAS = require("./schemas");

let sheetsClient = null;

function loadCredentials() {
  if (config.serviceAccountJson) return JSON.parse(config.serviceAccountJson);
  const raw = fs.readFileSync(config.serviceAccountFile, "utf8");
  return JSON.parse(raw);
}

async function client() {
  if (sheetsClient) return sheetsClient;
  const creds = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.file"],
  });
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

// Sheets serial (ngay) -> ISO string; giu nguyen neu khong phai so
function cellOut(v) {
  if (typeof v === "number" && isFinite(v) && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return isNaN(d.getTime()) ? v : d.toISOString();
  }
  return v === undefined || v === null ? "" : v;
}

// ISO 'yyyy-MM-dd' -> gui dang chuoi (Sheet tu nhan ngay)
function cellIn(v) {
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}T${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`;
  }
  return v === undefined || v === null ? "" : v;
}

async function getMeta(spreadsheetId) {
  const s = await client();
  const { data } = await s.spreadsheets.get({ spreadsheetId });
  return data.sheets.map((x) => x.properties.title);
}

async function ensureSheet(spreadsheetId, name) {
  const s = await client();
  const titles = await getMeta(spreadsheetId);
  if (!titles.includes(name)) {
    await s.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: name } } }] } });
  }
}

/** Dam bao du so cot, chi dien o header TRONG (khong doi ten that) */
async function ensureTable(spreadsheetId, name) {
  await ensureSheet(spreadsheetId, name);
  const want = SCHEMAS[name] || [];
  if (!want.length) return;
  const s = await client();
  const { data } = await s.spreadsheets.values.get({ spreadsheetId, range: `'${name}'!1:1` });
  const cur = (data.values && data.values[0]) || [];
  let patched = false;
  const row = cur.slice();
  for (let i = 0; i < want.length; i++) {
    if (!row[i]) { row[i] = want[i]; patched = true; }
  }
  if (patched) {
    await s.spreadsheets.values.update({
      spreadsheetId, range: `'${name}'!A1`, valueInputOption: "RAW", requestBody: { values: [row] },
    });
  }
}

/** Doc full bang: {headers, rows, rowNums} — rows la mang theo vi tri cot */
async function readTable(spreadsheetId, name) {
  await ensureTable(spreadsheetId, name);
  const s = await client();
  const { data } = await s.spreadsheets.values.get({ spreadsheetId, range: `'${name}'!A:Z` });
  const vals = data.values || [];
  if (!vals.length) return { headers: [], rows: [], rowNums: [] };
  const headers = vals[0].map((h) => String(h));
  const nCol = Math.max(headers.length, 1);
  const rows = [], rowNums = [];
  for (let i = 1; i < vals.length; i++) {
    const r = vals[i];
    if (r.every((c) => c === "" || c === undefined)) continue;
    const row = [];
    for (let c = 0; c < nCol; c++) row.push(cellOut(r[c]));
    rows.push(row);
    rowNums.push(i + 1);
  }
  return { headers, rows, rowNums };
}

async function appendRow(spreadsheetId, name, row) {
  const s = await client();
  const t = await readTable(spreadsheetId, name);
  const nCol = Math.max(t.headers.length, row.length);
  const full = [];
  for (let i = 0; i < nCol; i++) full.push(cellIn(row[i]));
  await s.spreadsheets.values.append({
    spreadsheetId, range: `'${name}'!A:Z`, valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS", requestBody: { values: [full] },
  });
  return { row: t.rowNums.length ? t.rowNums[t.rowNums.length - 1] + 1 : 2 };
}

async function updateRow(spreadsheetId, name, rowNum, values) {
  const s = await client();
  const t = await readTable(spreadsheetId, name);
  if (!(rowNum >= 2) || rowNum > t.rowNums[t.rowNums.length - 1] + 1) throw new Error("Dong khong ton tai: " + rowNum);
  const cur = await s.spreadsheets.values.get({ spreadsheetId, range: `'${name}'!A${rowNum}:Z${rowNum}` });
  const nCol = Math.max(t.headers.length, (cur.data.values && cur.data.values[0].length) || 0);
  const oldRow = ((cur.data.values && cur.data.values[0]) || []).map(cellOut);
  const next = [];
  for (let i = 0; i < nCol; i++) {
    const v = values && values[i] !== undefined && values[i] !== "" ? values[i] : oldRow[i];
    next.push(cellIn(v === undefined ? "" : v));
  }
  await s.spreadsheets.values.update({
    spreadsheetId, range: `'${name}'!A${rowNum}`, valueInputOption: "USER_ENTERED", requestBody: { values: [next] },
  });
  return { before: oldRow.slice(0, 3).join("|") };
}

async function deleteRow(spreadsheetId, name, rowNum) {
  const s = await client();
  const meta = await s.spreadsheets.get({ spreadsheetId });
  const sh = meta.data.sheets.find((x) => x.properties.title === name);
  if (!sh) throw new Error("Thieu sheet: " + name);
  if (!(rowNum >= 2)) throw new Error("Dong khong ton tai: " + rowNum);
  await s.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ deleteDimension: { range: { sheetId: sh.properties.sheetId, dimension: "ROWS", startIndex: rowNum - 1, endIndex: rowNum } } }] },
  });
  return { row: rowNum };
}

module.exports = { client, cellOut, ensureTable, readTable, appendRow, updateRow, deleteRow };
