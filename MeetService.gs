/**
 * MeetService.gs — Demo Nhan Su V1.0.0 (tu sinh link Google Meet that)
 * Can bat: Apps Script Editor -> Services (+) -> Google Calendar API -> Add.
 * Quyen Calendar tu dong xin khi chay. Chua bat service -> tra "" (ghi tay).
 */

function autoMeetLink_(tieuDe, batDau, phut, moTa) {
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

/** Chay trong Editor de xem loi that: tra ve {calendar, link, error} */
function testCreateMeet() {
  var info = { calendar: false, link: "", error: "" };
  try {
    info.calendar = (typeof Calendar !== "undefined" && !!Calendar.Events && !!Calendar.Events.insert);
  } catch (e) { info.calendar = false; }
  if (!info.calendar) {
    info.error = "Chua bat Services > Google Calendar API trong Editor";
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
