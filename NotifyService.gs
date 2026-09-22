/**
 * NotifyService.gs — Demo Nhan Su V1.0.0 (Telegram that + Zalo log hang doi)
 * Cau hinh ScriptProperties: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (optional).
 * Chua co token -> tra {simulated:true}, KHONG bao da gui ao: ghi RECORD_ZALO = SIMULATED.
 * Phu thuoc: Config.gs, SyncService.gs (getSheetByIds_, logAudit_).
 */

function tgConfig_() {
  var p = {};
  try { p = PropertiesService.getScriptProperties().getProperties(); } catch (e) {}
  return { token: p.TELEGRAM_BOT_TOKEN || "", chatId: p.TELEGRAM_CHAT_ID || "" };
}

function logZalo_(nguoiNhan, loai, noiDung, trangThai, loi) {
  getSheetByIds_(CONFIG.SPREADSHEET_ID, "RECORD_ZALO").appendRow([
    Utilities.getUuid(), new Date(), String(nguoiNhan), loai,
    String(noiDung).substring(0, 4000), trangThai, String(loi || "").substring(0, 1000)
  ]);
}

/** Gui Telegram that. to: chatId (trong -> dung TELEGRAM_CHAT_ID chung). */
function sendTelegram(to, text) {
  var cfg = tgConfig_();
  var chatId = to || cfg.chatId;
  if (!cfg.token || !chatId) {
    logZalo_(chatId || "?", "TELEGRAM", text, "SIMULATED", "Chua cau hinh TELEGRAM_BOT_TOKEN/CHAT_ID");
    return { success: false, simulated: true, message: "Chua cau hinh Bot Token" };
  }
  try {
    var res = UrlFetchApp.fetch("https://api.telegram.org/bot" + cfg.token + "/sendMessage", {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, text: String(text).substring(0, 4000) }),
      muteHttpExceptions: true
    });
    var ok = res.getResponseCode() === 200;
    logZalo_(chatId, "TELEGRAM", text, ok ? "SENT" : "FAILED", ok ? "" : res.getContentText().substring(0, 500));
    return { success: ok, chatId: chatId };
  } catch (e) {
    logZalo_(chatId, "TELEGRAM", text, "FAILED", String(e.message || e).substring(0, 500));
    return { success: false, error: String(e.message || e) };
  }
}

/** Zalo OA can access token + template: Demo chi ghi hang doi de ke toan/HR duyet tay. */
function sendZalo(nguoiNhan, loai, noiDung) {
  logZalo_(nguoiNhan, loai || "TEXT", noiDung, "SIMULATED", "Demo V1: can Zalo OA token de gui that");
  return { success: false, simulated: true, message: "Da ghi hang doi RECORD_ZALO (SIMULATED)" };
}

/**
 * Gui that qua Zalo OA (can ScriptProperties ZALO_OA_TOKEN + nguoi nhan la OA user_id da follow).
 * Nhan SDT thuong -> khong gui duoc truc tiep (can ZNS template) -> SIMULATED + huong dan.
 */
function sendZaloInvite_(nguoiNhan, text) {
  var cfg = {};
  try { cfg = PropertiesService.getScriptProperties().getProperties(); } catch (e) {}
  var token = cfg.ZALO_OA_TOKEN || "";
  var target = String(nguoiNhan || "");
  var isPhone = /^0\d{9}$/.test(target.replace(/\D/g, "")) && target.replace(/\D/g, "").length === 10;
  if (!token) {
    logZalo_(target, "MOI_PV", text, "SIMULATED", "Chua cau hinh ZALO_OA_TOKEN - HR nhan tay qua zalo.me");
    return { real: false, reason: "NO_TOKEN" };
  }
  if (isPhone) {
    logZalo_(target, "MOI_PV", text, "SIMULATED", "Gui truc tiep den SDT can ZNS template da duyet - HR nhan tay qua zalo.me/" + target.replace(/\D/g, ""));
    return { real: false, reason: "NEED_ZNS_OR_USER_ID" };
  }
  try {
    var res = UrlFetchApp.fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
      method: "post", muteHttpExceptions: true,
      headers: { access_token: token, "Content-Type": "application/json" },
      payload: JSON.stringify({ recipient: { user_id: target }, message: { text: String(text).substring(0, 1000) } })
    });
    var body = JSON.parse(res.getContentText() || "{}");
    var ok = res.getResponseCode() === 200 && (body.error === 0 || body.message === "Success");
    logZalo_(target, "MOI_PV", text, ok ? "SENT_OA" : "FAILED", ok ? "" : res.getContentText().substring(0, 500));
    return { real: ok };
  } catch (e) {
    logZalo_(target, "MOI_PV", text, "FAILED", String((e && e.message) || e).substring(0, 500));
    return { real: false, reason: "EXCEPTION" };
  }
}

/** Moi phong van: Telegram neu duoc + luon log Zalo */
function inviteInterview(maCa) {
  var sh = getSheetByIds_(CONFIG.SPREADSHEET_ID, "LICH_PHONG_VAN");
  var vals = sh.getDataRange().getValues();
  var found = null;
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(maCa)) { found = vals[i]; break; }
  }
  if (!found) throw new Error("Khong tim thay Ma ca: " + maCa);
  var text = "[UBM PV] Xin chao " + found[1] + ", lich phong van luc "
    + (found[3] instanceof Date ? found[3].toLocaleString("vi-VN") : found[3])
    + ". Meet: " + (found[4] || "(HR se cap nhat)") + ". Vui long xac nhan!";
  var tg = sendTelegram("", text);
  logZalo_(String(found[2]), "MOI_PV", text, tg.success ? "SENT_TG" : "SIMULATED", "");
  return { success: true, maCa: maCa, telegram: tg };
}

/** Goi sau moi lan diem danh (tu dong tu TrainingService). */
function notifyCheckin(maNV, kind) {
  var text = "[UBM DIEM DANH] " + maNV + " " + kind + " luc " + new Date().toLocaleString("vi-VN");
  return sendTelegram("", text);
}
