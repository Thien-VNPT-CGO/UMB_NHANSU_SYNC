/**
 * Code.gs — Demo Nhan Su V1.0.0 (Router + Dispatcher)
 * Deploy: Deploy > New deployment > Web app (Execute as: Me, Access: Anyone).
 * Frontend goi: google.script.run.apiDispatcher(action, payload, token)
 */

function doGet(e) {
  e = e || {};
  var p = (e.parameter) || {};
  // API GET nhe cho test nhanh: ?action=ping | ?action=testMeet
  if (p.action === "ping") {
    return ContentService.createTextOutput(JSON.stringify({ success: true, demo: "NhanSu V1.0.0", time: new Date() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (p.action === "testMeet") {
    var info = (typeof testCreateMeet === "function") ? testCreateMeet() : { calendar: false, link: "", error: "Chua nap file MeetService.gs (tao file Script ten MeetService, dan code, Save, Deploy New version)" };
    return ContentService.createTextOutput(JSON.stringify(info))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (p.action === "status") {
    return ContentService.createTextOutput(JSON.stringify(checkFilesStatus_()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (p.action === "pendingPV") {
    var wantK = "";
    try { wantK = PropertiesService.getScriptProperties().getProperty("BRIDGE_KEY") || ""; } catch (eK) {}
    if (!wantK || p.key !== wantK) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Sai key. Dat ScriptProperties BRIDGE_KEY va goi ?action=pendingPV&key=..." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify(listPendingPV_()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var page = String(p.page || "nhanvien").toLowerCase();
  var files = { master: "WebApp_Admin", admin: "WebApp_Admin", hr: "WebApp_HR", ketoan: "WebApp_KeToan", nhanvien: "WebApp_NhanVien" };
  var f = files[page] || files.nhanvien;
  try {
    var out = HtmlService.createHtmlOutputFromFile(f)
      .setTitle("Hệ Thống HR - UmBoMIlk")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
    var fav = faviconUrl_();
    if (fav) out.setFaviconUrl(fav);
    return out;
  } catch (err) {
    // Chua co file .html frontend -> tra trang thai de van deploy/test backend duoc
    var html = "<h3>Demo Nhan Su V1.0.0</h3><p>Backend OK. Frontend <b>" + f + ".html</b> chua nap.</p>"
      + "<p>Test: <a href='?action=ping'>?action=ping</a></p><p>" + new Date() + "</p>";
    return HtmlService.createHtmlOutput(html).setTitle("Demo Nhan Su V1.0.0");
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) {}
  if (!body.action) {
    // Webhook Zalo (that, bot ca nhan, hoac mo phong): {maCa, reply|text}
    var wantB = "";
    try { wantB = PropertiesService.getScriptProperties().getProperty("BRIDGE_KEY") || ""; } catch (eB) {}
    if (wantB && !body.event_name && body.key !== wantB) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Sai bridge key" })).setMimeType(ContentService.MimeType.JSON);
    }
    var maCa = body.maCa || body.ma_ca || "";
    var reply = body.reply || body.text || ((body.message && body.message.text) || "");
    if (maCa && reply !== "") {
      var zr;
      try { zr = handleZaloReply(maCa, reply); }
      catch (err2) { zr = { success: false, error: String((err2 && err2.message) || err2) }; }
      return ContentService.createTextOutput(JSON.stringify(zr)).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Webhook: thieu maCa/reply" })).setMimeType(ContentService.MimeType.JSON);
  }
  var r = apiDispatcher(body.action, body.payload, body.token);
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

/** Trang ?action=status: liet ke ham backend thieu (= file .gs chua nap) */
function checkFilesStatus_() {
  var need = {
    "AuthService.gs": ["loginAdmin", "loginInternal", "loginEmployee", "verifyToken_"],
    "Database.gs": ["getMainSpreadsheet", "setupFrom17iXM"],
    "SyncService.gs": ["syncFormToNhanVienMoi", "getSheetByIds_", "logAudit_"],
    "InterviewService.gs": ["createInterviewSchedule", "createSingleInterview", "confirmInterview", "passInterviewToTraining", "failInterview"],
    "TrainingService.gs": ["approveTrainingPhone", "registerTrainingOff", "trainingAttendance", "submitTrainingTest", "promoteToOfficial"],
    "OfficialService.gs": ["approveOfficialPhone", "registerWeeklyOff", "getWeeklySchedule", "requestShiftSwap", "approveShiftSwap", "calculateOfficialSalary"],
    "ExamService.gs": ["createKhoaTest", "scheduleOfficialTest", "gradeOfficialTest"],
    "MaintenanceService.gs": ["getMaintenance", "setMaintenance"],
    "DriveService.gs": ["uploadPhoto"],
    "NotifyService.gs": ["sendTelegram", "sendZalo", "inviteInterview", "notifyCheckin"],
    "MeetService.gs": ["autoMeetLink_", "testCreateMeet"],
    "DataService.gs": ["listTable", "getDashboard", "createRow", "updateRow", "deleteRow"]
  };
  var missing = {}, okCount = 0, total = 0;
  Object.keys(need).forEach(function (file) {
    var miss = [];
    need[file].forEach(function (fn) {
      total++;
      var exists = false;
      try { exists = (typeof globalThis[fn] === "function"); } catch (e) { exists = false; }
      if (exists) okCount++; else miss.push(fn);
    });
    if (miss.length) missing[file] = miss;
  });
  var htmlNeed = ["WebApp_Admin", "WebApp_HR", "WebApp_KeToan", "WebApp_NhanVien"];
  return { success: Object.keys(missing).length === 0, functionsOk: okCount + "/" + total, missingFunctionsByFile: missing, htmlRequired: htmlNeed };
}
var PUBLIC_ACTIONS_ = ["loginAdmin", "loginInternal", "loginEmployee", "ping", "getMaintenance"];

/** URL favicon khi deploy: up logo_web.jpg len Drive, Share Anyone, dat ScriptProperties LOGO_URL = link download truc tiep */
function faviconUrl_() {
  try {
    return PropertiesService.getScriptProperties().getProperty("LOGO_URL") || "";
  } catch (e) { return ""; }
}

function apiDispatcher(action, payload, token) {
  payload = payload || {};
  try {
    if (PUBLIC_ACTIONS_.indexOf(action) < 0) verifyToken_(token);
    // Chan tab dang bao tri (frontend gui kem payload.tab)
    if (payload.tab && isTabOff_(payload.tab)) {
      var info = getMaintMap_()[payload.tab] || {};
      throw new Error("Tab [" + payload.tab + "] dang bao tri" + (info.lyDo ? ": " + info.lyDo : ""));
    }
    switch (action) {
      case "ping": return { success: true, time: new Date() };
      case "loginAdmin": return loginAdmin(payload.username, payload.password);
      case "loginInternal": return loginInternal(payload.username, payload.pin);
      case "loginEmployee": return loginEmployee(payload.sdt);
      case "logout": return logout(token);
      case "me": return { success: true, session: verifyToken_(token) };

      // G1
      case "syncForm": return syncFormToNhanVienMoi();
      // G2
      case "createInterviewSchedule": return createInterviewSchedule();
      case "createSingleInterview": return createSingleInterview(payload.sdt, payload.thoiGianHen, payload.linkMeet);
      case "confirmInterview": return confirmInterview(payload.maCa, payload.xacNhan, payload.danhGia);
      case "passInterview": return passInterviewToTraining(payload.maCa);
      case "failInterview": return failInterview(payload.maCa, payload.lyDo);
      // G3
      case "approveTraining": return approveTrainingPhone(payload.maNV);
      case "approveOfficial": return approveOfficialPhone(payload.maNV);
      case "registerTrainingOff": return registerTrainingOff(payload.maNV, payload.offDates);
      case "attendance": return trainingAttendance(payload.maNV, payload.kind, payload.opts);
      case "submitTest": return submitTrainingTest(payload.maNV, payload.diem, payload.dung, payload.tong, payload.khoa);
      case "promote": return promoteToOfficial(payload.maNV);
      // G4
      case "registerWeeklyOff": return registerWeeklyOff(payload.maNV, payload.tuan, payload.offDates);
      case "weeklySchedule": return getWeeklySchedule(payload.maNV, payload.tuan);
      case "requestSwap": return requestShiftSwap(payload.maNV, payload.ngay, payload.caCu, payload.caMoi, payload.nvThay, payload.lyDo);
      case "approveSwap": return approveShiftSwap(payload.phieuId, payload.nguoiDuyet, payload.duyet);
      case "salary": return calculateOfficialSalary(payload.maNV, payload.thang);
      // Admin
      case "createAccount": return createInternalAccount(payload, token);
      case "listAccounts": return listAccounts(token);
      // Doc du lieu
      case "listTable": return listTable(payload.sheet, payload.opts, token);
      case "dashboard": return getDashboard(token);
      // CRUD
      case "createRow": return createRow(payload.sheet, payload.values, token);
      case "updateRow": return updateRow(payload.sheet, payload.row, payload.values, token);
      case "deleteRow": return deleteRow(payload.sheet, payload.row, token);
      // Thi dau ra
      case "createKhoa": return createKhoaTest(payload.tenKhoa, payload.soCau, payload.toiThieu);
      case "scheduleTest": return scheduleOfficialTest(payload.ten, payload.sdt, payload.thoiGianHen, payload.linkMeet);
      case "gradeTest": return gradeOfficialTest(payload.maTest, payload.diem, payload.nhanXet);
      // Bao tri
      case "getMaintenance": return getMaintenance();
      case "setMaintenance": return setMaintenance(payload.tab, payload.off, payload.lyDo, payload.moLai, token);
      // Drive
      case "uploadPhoto": return uploadPhoto(payload.maNV, payload.kind, payload.base64, payload.mimeType);
      // Thong bao
      case "sendTelegram": return sendTelegram(payload.to, payload.text);
      case "sendZalo": return sendZalo(payload.to, payload.loai, payload.noiDung);
      case "inviteInterview": return inviteInterview(payload.maCa);
      case "sendInvite": return sendInterviewInviteZalo(payload.maCa);
      case "zaloReply": return handleZaloReply(payload.maCa, payload.reply || payload.text);
      case "testMeet": return testCreateMeet();

      default: throw new Error("Action khong ton tai: " + action);
    }
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  }
}
