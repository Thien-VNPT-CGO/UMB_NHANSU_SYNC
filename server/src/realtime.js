"use strict";
/**
 * realtime.js — Socket.IO router. Client goi: socket.emit("call", {action, payload, token}, ack)
 * Ten action GIU NGUYEN nhu apiDispatcher Apps Script de frontend doi de dang.
 * Domain logic G1-G4+ (tuyen/PV/training/official/luong/thi/notify/meet) o phase 2 (modules/).
 */
const sessions = require("./sessions");
const auth = require("./auth");
const tables = require("./tables");
const appstate = require("./appstate");

const PUBLIC = ["ping", "loginAdmin", "loginInternal", "loginEmployee", "getMaintenance"];

async function dispatch(action, payload, token, io) {
  payload = payload || {};
  if (!PUBLIC.includes(action)) sessions.verify(token);
  const sess = PUBLIC.includes(action) && action !== "me" ? null : safeSess(token);
  if (payload.tab) {
    const m = await appstate.getMap();
    if (appstate.isOff(m, payload.tab)) {
      const info = m[payload.tab] || {};
      throw new Error("Tab [" + payload.tab + "] dang bao tri" + (info.lyDo ? ": " + info.lyDo : ""));
    }
  }
  switch (action) {
    case "ping": return { success: true, time: new Date(), server: "socket" };
    case "loginAdmin": return auth.loginAdmin(payload.username, payload.password);
    case "loginInternal": return auth.loginInternal(payload.username, payload.pin);
    case "loginEmployee": return auth.loginEmployee(payload.sdt);
    case "logout": return sessions.destroy(token);
    case "me": return { success: true, session: sessions.verify(token) };
    case "dashboard": return tables.dashboard();
    case "listTable": return tables.listTable(payload.sheet, payload.opts, sess);
    case "createRow": return tables.createRow(payload.sheet, payload.values, sess);
    case "updateRow": return tables.updateRow(payload.sheet, payload.row, payload.values, sess);
    case "deleteRow": return tables.deleteRow(payload.sheet, payload.row, sess);
    case "listAccounts": return auth.listAccounts(sess);
    case "createAccount": {
      const r = await auth.createInternalAccount({ gmail: payload.gmail, hoten: payload.hoten, sdt: payload.sdt, role: payload.role, pin: payload.pin }, sess);
      broadcast(io, "TAI_KHOAN");
      return r;
    }
    case "getMaintenance": return appstate.getMaintenance();
    case "setMaintenance": {
      const r = await appstate.setMaintenance(payload.tab, payload.off, payload.lyDo, sess);
      broadcast(io, null, { maint: true });
      return r;
    }
    default: throw new Error("Action chua chuyen sang server socket (dung Apps Script tam): " + action);
  }
}

function safeSess(token) {
  try { return sessions.verify(token); } catch (e) { return null; }
}

function broadcast(io, sheet, extra) {
  if (!io) return;
  io.of("/hrm").emit("data:changed", { sheet, ...(extra || {}), at: new Date().toISOString() });
}

function attach(io) {
  const nsp = io.of("/hrm");
  nsp.on("connection", (socket) => {
    socket.on("call", async (msg, ack) => {
      const cb = typeof ack === "function" ? ack : () => {};
      try {
        const r = await dispatch(msg.action, msg.payload, msg.token, io);
        if (r && r.success === undefined) r.success = true;
        cb({ success: true, ...r });
        if (["createRow", "updateRow", "deleteRow"].includes(msg.action) && msg.payload && msg.payload.sheet) {
          broadcast(io, msg.payload.sheet);
        }
      } catch (e) {
        cb({ success: false, error: String((e && e.message) || e) });
      }
    });
  });
}

module.exports = { attach, dispatch };
