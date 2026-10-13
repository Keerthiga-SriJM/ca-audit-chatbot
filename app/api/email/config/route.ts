import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import re from "node:path";
import { verifySmtpConnection } from "@/lib/email";

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
  const envPath = path.resolve(process.cwd(), ".env");
  let hasPass = false;
  let smtpUser = process.env.SMTP_USER || "keerthigasrijm@gmail.com";

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/^SMTP_PASS=(.*)$/m);
    if (match && match[1]?.trim()) {
      hasPass = !match[1].includes("your-app-password") && match[1].trim().length >= 8;
    }
    const userMatch = content.match(/^SMTP_USER=(.*)$/m);
    if (userMatch && userMatch[1]?.trim()) {
      smtpUser = userMatch[1].trim();
    }
  }

  return NextResponse.json({
    configured: hasPass,
    smtpUser,
    hasPass,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { smtpPass, testEmail } = (await req.json()) as {
      smtpPass?: string;
      testEmail?: string;
    };

    if (!smtpPass || smtpPass.trim().length < 8) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid 16-character Google App Password." },
        { status: 400 }
      );
    }

    const cleanPass = smtpPass.trim().replace(/\s+/g, "");
    updateEnvFile("SMTP_PASS", cleanPass);

    // Verify SMTP connection
    const verifyResult = await verifySmtpConnection(testEmail);
    if (!verifyResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: verifyResult.error || "Failed to authenticate with Gmail SMTP. Please check your App Password.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: verifyResult.message || "Gmail App Password saved and verified! Automated emails are now active.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
