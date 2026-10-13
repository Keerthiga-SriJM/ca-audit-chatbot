import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export const runtime = "nodejs";

export async function POST() {
  try {
    const credPath = path.resolve(process.cwd(), "credentials.json");
    if (!fs.existsSync(credPath)) {
      return NextResponse.json(
        { success: false, error: "credentials.json not found in project root." },
        { status: 400 }
      );
    }

    const scriptPath = path.resolve(process.cwd(), "scripts", "google-auth.ts");
    const pyScriptPath = path.resolve(process.cwd(), "get_refresh_token.py");

    // Spawn the OAuth flow runner
    const child = fs.existsSync(scriptPath)
      ? spawn("npx", ["tsx", scriptPath], {
          cwd: process.cwd(),
          detached: true,
          stdio: "ignore",
          shell: true,
        })
      : spawn("python", [pyScriptPath], {
          cwd: process.cwd(),
          detached: true,
          stdio: "ignore",
          shell: true,
        });

    child.unref();

    return NextResponse.json({
      success: true,
      message: "Browser authorization window opened! Please sign in with your Google account and click 'Allow' to authorize Google Calendar.",
    });
  } catch (err: any) {
    console.error("API /api/calendar/connect error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to start Google OAuth process." },
      { status: 500 }
    );
  }
}
