/**
 * MeetService.gs — Demo Nhan Su V1.0.0 (tu sinh link Google Meet that)
 * Can bat: Apps Script Editor -> Services (+) -> Google Calendar API -> Add.
 * Quyen Calendar tu dong xin khi chay. Chua bat service -> tra "" (ghi tay).
 */

function autoMeetLink_(tieuDe, batDau, phut, moTa) {
  var start = new Date(batDau);
  if (!isNaN(start.getTime())) {
    var viaRender = tryRenderMeet_(tieuDe, start, phut);
    if (viaRender) return viaRender;
  }
  try {
    if (typeof Calendar === "undefined" || !Calendar.Events || !Calendar.Events.insert) return "";
    var start = new Date(batDau);
    if (isNaN(start.getTime())) return "";
    var end = new Date(start.getTime() + (Number(phut) || 60) * 60000);
    var ev = Calendar.Events.insert({
      summary: tieuDe || "Phong van UBM",
      description: moTa || "Lich tu dong tao tu Demo Nhan Su V1.0.0",
      start: { dateTime: start.toISOString(), timeZone: "Asia/Ho_Chi_Minh" },
      end: { dateTime: end.toISOString(), timeZone: "Asia/Ho_Chi_Minh" },
      conferenceData: { createRequest: { requestId: Utilities.getUuid().replace(/-/g, "").substring(0, 16), conferenceSolutionKey: { type: "hangoutsMeet" } } }
    }, "primary", { conferenceDataVersion: 1 });
    if (ev && ev.conferenceData && ev.conferenceData.entryPoints) {
      for (var i = 0; i < ev.conferenceData.entryPoints.length; i++) {
        if (ev.conferenceData.entryPoints[i].uri) return ev.conferenceData.entryPoints[i].uri;
      }
    }
    return ev.hangoutLink || "";
  } catch (e) {
    return "";
  }
}

/** Goi bot Render tao Meet (qua Gmail ca nhan) - can ScriptProperties RENDER_BOT_URL + BRIDGE_KEY */
function tryRenderMeet_(tieuDe, start, phut) {
  var p = {};
  try { p = PropertiesService.getScriptProperties().getProperties(); } catch (e) {}
  var base = p.RENDER_BOT_URL || "";
  var key = p.BRIDGE_KEY || "";
  if (!base || !key) return "";
  try {
    var res = UrlFetchApp.fetch(base.replace(/\/$/, "") + "/meet", {
      method: "post", contentType: "application/json", muteHttpExceptions: true,
      payload: JSON.stringify({ key: key, title: tieuDe, start: start.toISOString(), minutes: phut || 45 })
    });
    var body = JSON.parse(res.getContentText() || "{}");
    return (body && body.success && body.link) ? body.link : "";
  } catch (e) {
    return "";
  }
}

/** Kiem tra nhanh Render (bot song? co Google creds?) - khong tao event that */
function checkRenderMeet_() {
  var out = { urlSet: false, botOk: false, googleConfigured: false, error: "" };
  var p = {};
  try { p = PropertiesService.getScriptProperties().getProperties(); } catch (e) {}
  var base = p.RENDER_BOT_URL || "";
  var key = p.BRIDGE_KEY || "";
  out.urlSet = !!base;
  if (!base || !key) { out.error = !base ? "Chua dat ScriptProperties RENDER_BOT_URL" : "Chua dat BRIDGE_KEY"; return out; }
  try {
    var res = UrlFetchApp.fetch(base.replace(/\/$/, "") + "/meet-check?key=" + encodeURIComponent(key), { muteHttpExceptions: true });
    var body = JSON.parse(res.getContentText() || "{}");
    out.botOk = res.getResponseCode() === 200 && !!body.success;
    out.googleConfigured = !!body.googleConfigured;
    if (!out.botOk) out.error = "Bot khong tra loi/Sai key: " + res.getContentText().substring(0, 200);
    else if (!out.googleConfigured) out.error = "Bot song nhung thieu GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN tren Render";
  } catch (e) {
    out.error = "Khong goi duoc bot (Render dang ngu? doi 1 phut thu lai): " + String((e && e.message) || e).substring(0, 200);
  }
  return out;
}

/** Chay trong Editor de xem loi that: tra ve {calendar, link, error, render} */
function testCreateMeet() {
  var info = { calendar: false, link: "", error: "", render: {} };
  try {
    info.calendar = (typeof Calendar !== "undefined" && !!Calendar.Events && !!Calendar.Events.insert);
  } catch (e) { info.calendar = false; }
  info.render = checkRenderMeet_();
  if (!info.calendar) {
    info.error = "Chua bat Services > Google Calendar API trong Editor (nhanh Render van co the chay - xem render)";
    return info;
  }
  try {
    var start = new Date(Date.now() + 3600000);
    var end = new Date(Date.now() + 7200000);
    var ev = Calendar.Events.insert({
      summary: "Test Meet UBM",
      start: { dateTime: start.toISOString(), timeZone: "Asia/Ho_Chi_Minh" },
      end: { dateTime: end.toISOString(), timeZone: "Asia/Ho_Chi_Minh" },
      conferenceData: { createRequest: { requestId: Utilities.getUuid().replace(/-/g, "").substring(0, 16), conferenceSolutionKey: { type: "hangoutsMeet" } } }
    }, "primary", { conferenceDataVersion: 1 });
    if (ev && ev.conferenceData && ev.conferenceData.entryPoints) {
      for (var i = 0; i < ev.conferenceData.entryPoints.length; i++) {
        if (ev.conferenceData.entryPoints[i].uri) { info.link = ev.conferenceData.entryPoints[i].uri; break; }
      }
    }
    if (!info.link && ev && ev.hangoutLink) info.link = ev.hangoutLink;
    if (!info.link) info.error = "API tra ve nhung khong co link (xem log). Title: " + (ev && ev.summary);
  } catch (e) {
    info.error = String((e && e.message) || e);
  }
  return info;
}
