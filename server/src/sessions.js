"use strict";
/** sessions.js — token 24h trong RAM (restart server phai login lai) */
const crypto = require("node:crypto");
const config = require("./config");

const store = new Map(); // token -> session {exp,...}

function create(prefix, data) {
  const token = prefix + crypto.randomUUID();
  const sess = { ...data, token, loginAt: new Date().toISOString(), exp: Date.now() + config.sessionTtlMs };
  store.set(token, sess);
  return sess;
}

function verify(token) {
  if (!token) throw new Error("Thieu token");
  const s = store.get(token);
  if (!s) throw new Error("Phien het han. Dang nhap lai.");
  if (s.exp < Date.now()) { store.delete(token); throw new Error("Phien het han. Dang nhap lai."); }
  return s;
}

function destroy(token) { store.delete(token); return { success: true }; }

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) if (v.exp < now) store.delete(k);
}, 600000).unref();

module.exports = { create, verify, destroy };
