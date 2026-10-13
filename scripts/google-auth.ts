import http from "node:http";
import url from "node:url";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

function getCredentials(): { clientId: string; clientSecret: string } {
  const credPath = path.resolve(process.cwd(), "credentials.json");
  if (fs.existsSync(credPath)) {
    const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    const inst = data.installed || data.web;
    if (inst?.client_id && inst?.client_secret) {
      return { clientId: inst.client_id, clientSecret: inst.client_secret };
    }
  }

  // Fallback to .env
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }

  throw new Error(
    "Could not find valid OAuth credentials in credentials.json or .env"
  );
}

function updateEnvFile(updates: Record<string, string>): void {
  const envPath = path.resolve(process.cwd(), ".env");
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trimEnd() + `\n${key}=${value}\n`;
    }
    process.env[key] = value;
  }

  fs.writeFileSync(envPath, content, "utf-8");
  console.log(`[OK] Successfully synchronized ${envPath}`);
}

function openBrowser(targetUrl: string): void {
  console.log(`Opening browser at: ${targetUrl}`);
  if (process.platform === "win32") {
    const escaped = targetUrl.replace(/'/g, "''");
    exec(`powershell -Command "Start-Process '${escaped}'"`, (err) => {
      if (err) {
        console.error("PowerShell browser launch error:", err);
      }
    });
  } else if (process.platform === "darwin") {
    exec(`open "${targetUrl}"`);
  } else {
    exec(`xdg-open "${targetUrl}"`);
  }
}

async function main() {
  const { clientId, clientSecret } = getCredentials();
  console.log("\n=======================================================");
  console.log("   GOOGLE CALENDAR OAUTH2 AUTHORIZATION");
  console.log("=======================================================");
  console.log(`Client ID: ${clientId}`);

  // Create temporary server on port 54321 or ephemeral
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url || "", true);
      const code = parsedUrl.query.code as string;
      const error = parsedUrl.query.error as string;

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h2>Google Authorization Error: ${error}</h2><p>Please try again.</p>`);
        return;
      }

      if (!code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("Waiting for Google authorization code...");
        return;
      }

      console.log("\n[1/3] Authorization code received from Google!");
      console.log("[2/3] Exchanging code for refresh token...");

      const redirectUri = `http://localhost:${(server.address() as any).port}`;
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      const { tokens } = await oauth2Client.getToken(code);

      const refreshToken = tokens.refresh_token;

      if (!refreshToken) {
        console.warn("\n[!] Warning: No refresh token returned by Google.");
        console.warn("If you previously granted access, Google may only return an access token.");
        console.warn("Visit https://myaccount.google.com/permissions to revoke and retry.");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h2 style="color: #ea580c;">Notice: Access Already Granted</h2>
              <p>Google did not return a new refresh token. Revoke app access in your Google Account security settings and retry to obtain a fresh refresh token.</p>
            </body>
          </html>
        `);
        setTimeout(() => process.exit(0), 1500);
        return;
      }

      console.log(`[3/3] Refresh token obtained! Length: ${refreshToken.length}`);
      console.log(`Token prefix: ${refreshToken.slice(0, 15)}...`);

      updateEnvFile({
        GOOGLE_CLIENT_ID: clientId,
        GOOGLE_CLIENT_SECRET: clientSecret,
        GOOGLE_REFRESH_TOKEN: refreshToken,
      });

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Calendar Connected</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0b1320; color: #ffffff; }
            .card { background: #132238; border: 1px solid #1e3a5f; border-radius: 16px; padding: 40px 48px; text-align: center; max-width: 460px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
            .badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
            h1 { margin: 0 0 12px; font-size: 24px; font-weight: 700; color: #ffffff; }
            p { color: #94a3b8; font-size: 14.5px; line-height: 1.6; margin: 0 0 28px; }
            .btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; transition: background 0.2s; }
            .btn:hover { background: #1d4ed8; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">✓ Authorization Complete</div>
            <h1>Google Calendar Connected!</h1>
            <p>Your Google Calendar API is now connected. Consultations scheduled in Audit Desk will now automatically sync directly to your calendar.</p>
            <a href="http://localhost:3000" class="btn">Return to Audit Desk</a>
          </div>
        </body>
        </html>
      `);

      console.log("\n=======================================================");
      console.log("  GOOGLE CALENDAR CONNECTED SUCCESSFULLY!");
      console.log("=======================================================\n");

      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1000);
    } catch (err: any) {
      console.error("Error handling Google OAuth callback:", err);
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h2>Failed to complete authorization: ${err?.message}</h2>`);
    }
  });

  server.listen(0, "127.0.0.1", () => {
    const port = (server.address() as any).port;
    const redirectUri = `http://localhost:${port}`;
    console.log(`Local listener started at: ${redirectUri}`);

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
    });

    console.log("\nLaunching Google Consent window in your default browser...\n");
    openBrowser(authUrl);
  });
}

main().catch((err) => {
  console.error("Authentication setup failed:", err);
  process.exit(1);
});
