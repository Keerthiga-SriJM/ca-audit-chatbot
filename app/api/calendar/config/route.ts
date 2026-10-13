import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getGoogleCredentials } from "@/lib/calendar";

export const runtime = "nodejs";

function updateEnvFile(key: string, value: string): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  let content = fs.readFileSync(envPath, "utf-8");
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content = content.trimEnd() + `\n${key}=${value}\n`;
  }
  fs.writeFileSync(envPath, content, "utf-8");
  process.env[key] = value;
}

export async function GET() {
  const creds = getGoogleCredentials();
  const credPath = path.resolve(process.cwd(), "credentials.json");
  const hasCredentialsFile = fs.existsSync(credPath);

  return NextResponse.json({
    configured: creds.isTokenValid,
    hasClientId: Boolean(creds.clientId),
    hasClientSecret: Boolean(creds.clientSecret),
    hasRefreshToken: creds.isTokenValid,
    hasCredentialsFile,
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    emailAccount: process.env.AUDITOR_EMAIL || process.env.SMTP_USER || "keerthigasri04@gmail.com",
    meetLink: process.env.AUDITOR_MEET_LINK || "https://meet.google.com/new",
  });
}

export async function POST(req: NextRequest) {
  try {
    const { refreshToken, clientId, clientSecret, meetLink } = (await req.json()) as {
      refreshToken?: string;
      clientId?: string;
      clientSecret?: string;
      meetLink?: string;
    };

    if (refreshToken && refreshToken.trim().length > 15) {
      updateEnvFile("GOOGLE_REFRESH_TOKEN", refreshToken.trim());
    }
    if (clientId && clientId.trim()) {
      updateEnvFile("GOOGLE_CLIENT_ID", clientId.trim());
    }
    if (clientSecret && clientSecret.trim()) {
      updateEnvFile("GOOGLE_CLIENT_SECRET", clientSecret.trim());
    }
    if (meetLink && meetLink.trim().startsWith("https://meet.google.com/")) {
      updateEnvFile("AUDITOR_MEET_LINK", meetLink.trim());
    }

    const updated = getGoogleCredentials();

    return NextResponse.json({
      success: true,
      configured: updated.isTokenValid,
      message: updated.isTokenValid
        ? "Google Calendar API connection active! Events will sync directly."
        : "Credentials saved. Run 'npm run google-token' or complete Google sign-in to activate direct API sync.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to update calendar configuration" },
      { status: 500 }
    );
  }
}
