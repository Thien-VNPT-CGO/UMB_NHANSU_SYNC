/**
 * zalo-personal-bot/bot.js — BOT Zalo CA NHAN cho Demo Nhan Su V1.0.0
 * Thu vien: zca-js (unofficial - co nguy co bi Zalo khoa acc, NEN DUNG ACC PHU).
 *
 * Cach chay (tren may tinh chay 24/7, Node >= 18):
 *   cd zalo-personal-bot
 *   npm install
 *   $env:APPS_SCRIPT_URL="https://script.google.com/macros/s/XXX/exec"  # PowerShell
 *   $env:BRIDGE_KEY="dat-chuoi-bi-mat-trung-voi-ScriptProperties-BRIDGE_KEY"
 *   npm start
 * Lan dau: quet QR Zalo de dang nhap -> tu luu credentials.json (lan sau khoi quet).
 * LUU Y: mo Zalo Web/PC song song se lam bot dung (1 listener/khoan).
 *
 * Luong chay:
 *  1. HR dat lich PV tren webapp -> ung vien nhan tin moi (HR nhan tay qua nut zalo).
 *  2. Ung vien rep "PV-20260922-001 DONG Y" (Ma ca co trong tin moi).
 *  3. Bot thay Ma ca -> POST ve Apps Script -> khoa lich DA_XAC_NHAN.
 *  4. Bot rep ung vien xac nhan da ghi nhan.
 */
import fs from "node:fs";
import http from "node:http";
import { google } from "googleapis";
import { Zalo, ThreadType } from "zca-js";

const CFG = {
  appScriptUrl: process.env.APPS_SCRIPT_URL || "",
  bridgeKey: process.env.BRIDGE_KEY || "",
  pollMs: 60000,
};
const credPath = new URL("./credentials.json", import.meta.url);
const bootAt = Date.now();

/** Google Calendar (Gmail ca nhan) de tao link Meet - can env GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN */
function googleCalendar() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) return null;
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth });
}

function jres(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

/** POST /meet {key,title,start,minutes} -> {success,link} (Apps Script goi sang) */
function handleMeet(req, res) {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    try {
      const b = JSON.parse(raw || "{}");
      if (!CFG.bridgeKey || b.key !== CFG.bridgeKey) return jres(res, 403, { success: false, error: "Sai key" });
      const cal = googleCalendar();
      if (!cal) return jres(res, 200, { success: false, error: "Thieu GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN" });
      const start = new Date(b.start);
      if (isNaN(start.getTime())) return jres(res, 200, { success: false, error: "start khong hop le" });
      const mins = Number(b.minutes) || 45;
      const end = new Date(start.getTime() + mins * 60000);
      const ev = await cal.events.insert({
        calendarId: "primary",
        conferenceDataVersion: 1,
        requestBody: {
          summary: b.title || "Phong van UBM",
          description: "Auto by UBM zalo bot",
          start: { dateTime: start.toISOString(), timeZone: "Asia/Ho_Chi_Minh" },
          end: { dateTime: end.toISOString(), timeZone: "Asia/Ho_Chi_Minh" },
          conferenceData: {
            createRequest: {
              requestId: Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        },
      });
      const eps = (ev.data.conferenceData && ev.data.conferenceData.entryPoints) || [];
      const link = ((eps.find((e) => e.uri) || {}).uri) || ev.data.hangoutLink || "";
      jres(res, 200, { success: !!link, link });
    } catch (e) {
      jres(res, 200, { success: false, error: String(e?.message || e).slice(0, 300) });
    }
  });
}

/** Web server mini cho UptimeRobot ping giu thuc (Render free) + kiem tra song/chet */
function startHealthServer() {
  const port = Number(process.env.PORT) || 3000;
  const srv = http.createServer((req, res) => {
    if (req.url === "/meet" && req.method === "POST") {
      handleMeet(req, res);
      return;
    }
    if (req.url === "/qr") {
      // QR dang nhap Zalo (file qr.png do zca-js tao, het han ~90s -> F5 lay ma moi)
      try {
        const img = fs.readFileSync(new URL("./qr.png", import.meta.url));
        res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
        res.end(img);
        return;
      } catch (e) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Chua co QR (bot da login? hoac doi vai giay roi F5)");
        return;
      }
    }
    const body = JSON.stringify({ ok: true, bot: "ubm-zalo-personal-bot", uptimeSec: Math.floor((Date.now() - bootAt) / 1000), qr: "/qr" });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(req.url === "/" ? "UBM zalo bot OK - quet QR tai /qr" : body);
  });
  srv.listen(port, () => console.log(`[bot] health server on :${port}`));
}

if (!CFG.appScriptUrl) {
  console.error("[bot] THIEU APPS_SCRIPT_URL. Set env truoc khi chay.");
  process.exit(1);
}

async function pollPending() {
  const u = CFG.appScriptUrl + "?action=pendingPV" + (CFG.bridgeKey ? "&key=" + encodeURIComponent(CFG.bridgeKey) : "");
  const r = await fetch(u);
  const j = await r.json();
  if (j && j.success) console.log(`[bot] lich cho xac nhan: ${j.data.length}`);
  else console.log("[bot] pendingPV:", JSON.stringify(j));
}

async function pushReply(maCa, text) {
  const res = await fetch(CFG.appScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: CFG.bridgeKey, maCa, reply: text }),
  });
  return res.json().catch(() => ({}));
}

async function onMessage(api, m) {
  if (m.isSelf || m.type !== ThreadType.User) return;
  const text = typeof m?.data?.content === "string" ? m.data.content : "";
  if (!text) return;
  const found = text.match(/PV-\d{8}-\d{3}/i);
  if (!found) return; // khong phai tin xac nhan lich -> bo qua
  const maCa = found[0].toUpperCase();
  console.log(`[bot] reply ${maCa}: ${text}`);
  let j = {};
  try {
    j = await pushReply(maCa, text);
  } catch (e) {
    console.error("[bot] POST fail:", e?.message || e);
  }
  const ok = j && j.success;
  const state = (j && j.trangThai) || "";
  try {
    await api.sendMessage(
      {
        msg: ok
          ? `[UBM] Da ghi nhan xac nhan lich ${maCa} (${state}). Hen gap ban!`
          : `[UBM] Chua ghi nhan duoc (${(j && j.error) || "loi khong ro"}). Ban lien he HR nhe!`,
        quote: m.data,
      },
      m.threadId,
      m.type
    );
  } catch (e) {
    console.error("[bot] sendMessage fail:", e?.message || e);
  }
}

function loadCreds() {
  if (process.env.ZALO_CREDENTIALS) {
    try {
      return JSON.parse(process.env.ZALO_CREDENTIALS);
    } catch (e) {
      console.error("[bot] ZALO_CREDENTIALS khong phai JSON hop le");
    }
  }
  if (fs.existsSync(credPath)) return JSON.parse(fs.readFileSync(credPath, "utf8"));
  return null;
}

function credsToSave(api) {
  const ctx = api.getContext();
  return { cookie: ctx.cookie.toJSON()?.cookies || [], imei: ctx.imei, userAgent: ctx.userAgent };
}

async function main() {
  startHealthServer();
  const zalo = new Zalo();
  let api;
  const saved = loadCreds();
  if (saved) {
    api = await zalo.login(saved);
    console.log("[bot] login by saved credentials");
  } else {
    api = await zalo.loginQR();
    const creds = credsToSave(api);
    fs.writeFileSync(credPath, JSON.stringify(creds, null, 2), "utf8");
    console.log("[bot] QR login OK, da luu credentials.json");
    console.log("[bot] DEPLOY CLOUD: copy khoi JSON duoi day vao bien moi truong ZALO_CREDENTIALS (1 dong):");
    console.log(JSON.stringify(creds));
  }
  api.listener.on("message", (m) => onMessage(api, m).catch((e) => console.error("[msg]", e?.message || e)));
  api.listener.start();
  console.log("[bot] dang nghe... (Ctrl+C de dung)");
  setInterval(() => pollPending().catch(() => {}), CFG.pollMs);
  await pollPending();
}

main().catch((e) => {
  console.error("FATAL:", e?.message || e);
  process.exit(1);
});
