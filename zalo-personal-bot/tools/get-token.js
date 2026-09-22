/**
 * tools/get-token.js — Lay GOOGLE_REFRESH_TOKEN 1 lan (chay tren may tinh, Node >= 18)
 *
 * 1. Google Cloud Console (console.cloud.google.com) > New project (vd UBM-Meet)
 * 2. APIs & Services > Library > "Google Calendar API" > Enable
 * 3. APIs & Services > OAuth consent screen > User type: External > Create
 *    - App name: UBM Meet - them Gmail ca nhan vao "Test users" > Save
 * 4. APIs & Services > Credentials > Create Credentials > OAuth client ID
 *    - Application type: Desktop app > Create > copy Client ID + Client secret
 * 5. Trong thu muc zalo-personal-bot: npm install (da co googleapis)
 *    node tools/get-token.js CLIENT_ID CLIENT_SECRET
 * 6. Mo URL in ra > dang nhap Gmail ca nhan > Allow > copy code dan vao terminal
 * 7. Copy refresh_token in ra -> dan vao bien moi truong Render:
 *    GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN
 */
import { google } from "googleapis";
import readline from "node:readline";

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error("Dung: node tools/get-token.js CLIENT_ID CLIENT_SECRET");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(
  clientId,
  clientSecret,
  "http://localhost"
);

const url = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/calendar.events"],
});
console.log("\n1) Mo URL nay, dang nhap Gmail CA NHAN, Allow:\n");
console.log(url + "\n");
console.log("   Trinh duyet se bao 'khong the truy cap localhost' - BINH THUONG.");
console.log("   Copy doan code=4/... trong THANH DIA CHI trinh duyet.\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("2) Dan authorization code vao day: ", async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2.getToken(code.trim());
    console.log("\n=== COPY VAO RENDER ENV ===");
    console.log("GOOGLE_CLIENT_ID=" + clientId);
    console.log("GOOGLE_CLIENT_SECRET=" + clientSecret);
    console.log("GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);
  } catch (e) {
    console.error("LOI:", e?.message || e);
  }
});
