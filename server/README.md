# UBM HRM Socket Server — Google Sheet làm DB chính

Server Node.js + Socket.IO, đọc/ghi trực tiếp Google Sheet `MAIN_SHEET_ID` qua
Service Account. Tên action giữ nguyên như `apiDispatcher` Apps Script để
frontend chuyển đổi dễ dàng.

## 1. Tạo Service Account (1 lần)

1. [console.cloud.google.com](https://console.cloud.google.com) → project → **APIs & Services → Library** → bật **Google Sheets API** + **Google Drive API**.
2. **APIs & Services → Credentials → Create Credentials → Service account** → đặt tên `ubm-hrm` → Create (bỏ qua 2 bước quyền) → mở acc vừa tạo → **Keys → Add key → JSON** → tải file về.
3. Copy **email** của Service Account (dạng `...@....iam.gserviceaccount.com`).
4. Mở Google Sheet chính → **Share** → dán email đó → quyền **Editor** → Share.
   > BẮT BUỘC, không là lỗi 403. Làm tương tự Sheet Form nếu server cần đọc.

## 2. Chạy local thử

```
cd server
npm install
cp .env.example .env
# Dien .env: GOOGLE_SERVICE_ACCOUNT_FILE=./service-account.json
# (copy file JSON key vao server/service-account.json)
node src/index.js
```

Mở `http://localhost:3000/healthz` → `{"ok":true,...}` là sống.

## 3. Deploy Render (chạy 24/7)

1. Push folder `server/` lên GitHub (đã có trong repo).
2. Render → **New ＋ → Web Service** → repo → Root Directory: `server`, Build `npm install`, Start `node src/index.js`, gói **Starter** (free ngủ đông).
3. Environment: `MAIN_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` (dán nguyên JSON 1 dòng — an toàn hơn file), `ADMIN_USER/ADMIN_PASS`, `CORS_ORIGIN=https://...` (domain web frontend sau này).
4. UptimeRobot ping `/healthz` nếu dùng free.

## 4. Frontend nối socket (phase sau)

```html
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
<script>
const socket = io("https://xxx.onrender.com/hrm");
function api(action, payload, token) {
  return new Promise((res) => socket.emit("call", { action, payload, token }, res));
}
const r = await api("loginAdmin", { username: "admin", password: "..." });
const t = await api("listTable", { sheet: "TAI_KHOAN", opts: { limit: 50 } }, r.token);
socket.on("data:changed", (m) => console.log("Sheet doi:", m.sheet));
</script>
```

## Phase thực hiện

- [x] Phase 1 (khung): auth 3 loại, CRUD bảng, dashboard, bảo trì tab, session 24h, realtime `data:changed`
- [ ] Phase 2: domain G1–G4 (sync form, PV, training, official, lương, thi) + notify + meet + trigger
- [ ] Phase 3: 4 frontend chuyển sang socket + deploy web tĩnh
