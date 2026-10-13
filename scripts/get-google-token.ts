/**
 * One-time helper to get GOOGLE_REFRESH_TOKEN.
 * Usage: fill GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env, then run
 *   npm run google-token
 * Open the printed link, approve access, and copy the token it prints.
 */
import { google } from "googleapis";
import http from "node:http";
import fs from "node:fs";

// tiny .env reader so this script works without extra dependencies
for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const PORT = 3005;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
const oauth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT
);

const url = oauth.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/calendar.events"],
});

console.log("\n1) Make sure this redirect URI is added to your OAuth client:\n   " + REDIRECT);
console.log("\n2) Open this link and approve access:\n\n" + url + "\n");

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/oauth2callback")) return;
  const code = new URL(req.url, REDIRECT).searchParams.get("code");
  if (!code) {
    res.end("No code received.");
    return;
  }
  try {
    const { tokens } = await oauth.getToken(code);
    res.end("Done. You can close this tab and return to the terminal.");
    console.log("\nAdd this to your .env file:\n\nGOOGLE_REFRESH_TOKEN=" + tokens.refresh_token + "\n");
  } catch (e: any) {
    res.end("Error: " + e.message);
    console.error(e);
  } finally {
    server.close();
  }
});
server.listen(PORT);
