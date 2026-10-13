import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";

function reloadEnvFile(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env");
  const envMap: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          envMap[key] = val;
          process.env[key] = val;
        }
      }
    } catch (e: any) {
      console.error("Failed to read .env dynamically in email:", e?.message);
    }
  }
  return envMap;
}

export interface MeetingEmailData {
  topic: string;
  start: string; // YYYY-MM-DDTHH:mm:ss
  durationMinutes: number;
  meetLink: string;
  attendees: string[];
  timeZone?: string;
  auditorName?: string;
  auditorFirm?: string;
  auditorEmail?: string;
  auditorPhone?: string;
}

export interface SendEmailResult {
  success: boolean;
  sentTo: string[];
  messageId?: string;
  error?: string;
  reason?: "sent" | "smtp_not_configured" | "failed";
  mailtoUrl: string;
}

/** Formats local ISO string into a human-readable date and time */
export function formatMeetingTime(isoStr: string, timeZone: string = "Asia/Kolkata"): string {
  try {
    const date = new Date(isoStr.length === 19 ? isoStr + "Z" : isoStr);
    return date.toLocaleString("en-IN", {
      timeZone: "UTC", // Treat the wall-clock components literally
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}

/**
 * Converts a local wall-clock ISO string (e.g. 2026-10-06T15:00:00) in a specific timezone
 * (e.g. Asia/Kolkata) into an accurate UTC Date object.
 */
export function parseLocalDateToUtc(isoLocalStr: string, timeZone: string = "Asia/Kolkata"): Date {
  const clean = isoLocalStr.slice(0, 19);
  const [datePart, timePart = "00:00:00"] = clean.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours = 0, minutes = 0, seconds = 0] = timePart.split(":").map(Number);

  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(guess);
    const partMap: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") partMap[p.type] = Number(p.value);
    }

    const asLocal = Date.UTC(
      partMap.year,
      partMap.month - 1,
      partMap.day,
      partMap.hour === 24 ? 0 : partMap.hour,
      partMap.minute,
      partMap.second
    );

    const offsetMs = asLocal - guess.getTime();
    return new Date(guess.getTime() - offsetMs);
  } catch {
    return guess;
  }
}

/** Formats a Date object into UTC iCalendar format: YYYYMMDDTHHMMSSZ */
export function formatUtcToIcs(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/**
 * Builds an RFC 5545 compliant iCalendar string for automatic Google Calendar event creation.
 * Crucial fields included:
 * - METHOD:REQUEST
 * - ORGANIZER (required by Google to place event on Google Calendar automatically)
 * - ATTENDEE with RSVP=TRUE and PARTSTAT=NEEDS-ACTION
 * - Precise UTC DTSTART and DTEND
 * - STATUS:CONFIRMED and SEQUENCE:0
 */
export function buildIcsCalendarContent(data: MeetingEmailData): string {
  const tz = data.timeZone || process.env.TIMEZONE || "Asia/Kolkata";
  const startUtc = parseLocalDateToUtc(data.start, tz);
  const endUtc = new Date(startUtc.getTime() + data.durationMinutes * 60_000);

  const dtStart = formatUtcToIcs(startUtc);
  const dtEnd = formatUtcToIcs(endUtc);
  const dtStamp = formatUtcToIcs(new Date());

  const organizerName = data.auditorName || process.env.AUDITOR_NAME || "CA Keerthiga Sri J.M.";
  const organizerEmail =
    data.auditorEmail ||
    process.env.SMTP_USER ||
    process.env.AUDITOR_EMAIL ||
    "keerthigasri04@gmail.com";

  const uid = `audit-meet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@auditdesk.local`;

  const attendeesLines: string[] = [
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN="${organizerName}":mailto:${organizerEmail}`,
  ];

  for (const attendee of data.attendees) {
    if (attendee && attendee.includes("@") && attendee.toLowerCase() !== organizerEmail.toLowerCase()) {
      attendeesLines.push(
        `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${attendee}":mailto:${attendee}`
      );
    }
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Audit Desk//CA Consultation Scheduler//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `ORGANIZER;CN="${organizerName}":mailto:${organizerEmail}`,
    `SUMMARY:CA Audit Consultation: ${data.topic}`,
    `DESCRIPTION:CA Audit Consultation\\nTopic: ${data.topic}\\nAuditor: ${organizerName} (${data.auditorFirm || "J.M. & Associates"})\\nGoogle Meet Link: ${data.meetLink}`,
    `LOCATION:${data.meetLink}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "TRANSP:OPAQUE",
    ...attendeesLines,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

/** Builds a pre-filled mailto: link that opens the user's default email client */
export function buildMailtoUrl(data: MeetingEmailData): string {
  const recipients = data.attendees.join(",");
  const subject = encodeURIComponent(`Invitation: CA Audit Consultation — ${data.topic}`);
  const body = encodeURIComponent(
    `Dear Participant,\n\n` +
      `You are invited to a CA Audit Consultation scheduled with ${data.auditorName || "CA Keerthiga Sri J.M."} (${data.auditorFirm || "J.M. & Associates"}).\n\n` +
      `----------------------------------------\n` +
      `MEETING DETAILS\n` +
      `----------------------------------------\n` +
      `• Topic: ${data.topic}\n` +
      `• Date & Time: ${formatMeetingTime(data.start, data.timeZone)} (${data.timeZone || "Asia/Kolkata"})\n` +
      `• Duration: ${data.durationMinutes} Minutes\n` +
      `• Attendees: ${data.attendees.join(", ")}\n\n` +
      `👉 GOOGLE MEET LINK (Click to Join):\n` +
      `${data.meetLink}\n\n` +
      `Please click the link above at the scheduled time to enter the meeting directly.\n\n` +
      `Warm regards,\n` +
      `${data.auditorName || "CA Keerthiga Sri J.M."}\n` +
      `${data.auditorFirm || "J.M. & Associates Chartered Accountants"}\n` +
      `Contact: ${data.auditorEmail || ""}`
  );

  return `mailto:${recipients}?subject=${subject}&body=${body}`;
}

/** Generates clean, professional HTML for the invitation email */
export function buildMeetingEmailHtml(data: MeetingEmailData): string {
  const formattedTime = formatMeetingTime(data.start, data.timeZone);
  const auditorName = data.auditorName || "CA Keerthiga Sri J.M.";
  const auditorFirm = data.auditorFirm || "J.M. & Associates Chartered Accountants";
  const auditorEmail = data.auditorEmail || process.env.AUDITOR_EMAIL || "keerthigasri04@gmail.com";
  const auditorPhone = data.auditorPhone || "+91 96555 28291";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CA Audit Consultation Invitation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f2; margin: 0; padding: 24px; color: #111e30; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid #d5e0d2; }
    .header { background: #111e30; color: #ffffff; padding: 24px 28px; }
    .header .firm { font-size: 13px; color: #f1dfb5; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
    .header h1 { margin: 6px 0 0; font-size: 22px; font-weight: 700; color: #ffffff; }
    .content { padding: 28px; }
    .notice { font-size: 14.5px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .details-box { background: #f8faf6; border: 1px solid #e5ece2; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px; }
    .details-row { display: flex; padding: 7px 0; border-bottom: 1px solid #edf2eb; font-size: 14px; }
    .details-row:last-child { border-bottom: none; }
    .label { width: 130px; font-weight: 600; color: #4e6076; flex-shrink: 0; }
    .val { color: #111e30; font-weight: 500; word-break: break-word; }
    .cta-container { text-align: center; margin: 32px 0; }
    .cta-btn { display: inline-block; background-color: #1e7e4a; color: #ffffff !important; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 10px rgba(30,126,74,0.3); }
    .cta-btn:hover { background-color: #16653b; }
    .meet-url-box { background: #edf7f0; border: 1px dashed #a3d9b5; border-radius: 6px; padding: 10px 14px; font-size: 13px; color: #1e7e4a; text-align: center; word-break: break-all; margin-bottom: 24px; }
    .footer { border-top: 1px solid #e5ece2; padding: 20px 28px; background: #fafcfa; font-size: 12.5px; color: #8394a8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="firm">${auditorFirm}</div>
      <h1>CA Audit Consultation Invitation</h1>
    </div>
    <div class="content">
      <p class="notice">
        Hello,<br><br>
        A formal statutory audit & financial review consultation has been scheduled with <strong>${auditorName}</strong>. You are invited to join via Google Meet.
      </p>

      <div class="details-box">
        <div class="details-row">
          <div class="label">Agenda / Topic:</div>
          <div class="val"><strong>${data.topic}</strong></div>
        </div>
        <div class="details-row">
          <div class="label">Date & Time:</div>
          <div class="val"><strong>${formattedTime}</strong> (${data.timeZone || "Asia/Kolkata"})</div>
        </div>
        <div class="details-row">
          <div class="label">Duration:</div>
          <div class="val">${data.durationMinutes} Minutes</div>
        </div>
        <div class="details-row">
          <div class="label">Lead Auditor:</div>
          <div class="val">${auditorName} (${auditorFirm})</div>
        </div>
        <div class="details-row">
          <div class="label">Participants:</div>
          <div class="val">${data.attendees.join(", ")}</div>
        </div>
      </div>

      <div class="cta-container">
        <a href="${data.meetLink}" class="cta-btn" target="_blank" rel="noopener">
          📹 Join Google Meet Now
        </a>
      </div>

      <div class="meet-url-box">
        Meeting Link: <a href="${data.meetLink}" style="color: #1e7e4a; font-weight: 600;">${data.meetLink}</a>
      </div>

      <p style="font-size: 13px; color: #64748b; text-align: center;">
        Please click the button above at the scheduled time to enter the meeting directly.
      </p>
    </div>

    <div class="footer">
      <strong>Audit Desk · Chartered Accountants</strong><br>
      Auditor: ${auditorName} · Email: ${auditorEmail} · Phone: ${auditorPhone}<br>
      This invitation was automatically generated by Audit Desk Statutory Ledger Chatbot.
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Sends meeting invitation emails to all attendees via SMTP (Gmail or custom SMTP).
 * If SMTP credentials are not yet configured, returns mailtoUrl for seamless 1-click fallback.
 */
export async function sendMeetingInviteEmail(data: MeetingEmailData): Promise<SendEmailResult> {
  const mailtoUrl = buildMailtoUrl(data);

  const validAttendees = data.attendees
    .map((e) => (e || "").trim().toLowerCase())
    .filter((e) => e && e.includes("@") && e !== "keerthigasrijm@gmail.com");
  if (validAttendees.length === 0) {
    return {
      success: false,
      sentTo: [],
      reason: "failed",
      error: "No valid recipient email addresses provided.",
      mailtoUrl,
    };
  }

  reloadEnvFile();
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.AUDITOR_EMAIL || "keerthigasri04@gmail.com";
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);

  // If no SMTP password configured, return failure without manual mailto
  if (!smtpPass || smtpPass.trim() === "" || smtpPass.includes("your-app-password")) {
    console.error(
      "[lib/email] SMTP_PASS / GMAIL_APP_PASSWORD not set. Background automated email requires 16-character App Password."
    );
    return {
      success: false,
      sentTo: [],
      reason: "smtp_not_configured",
      error: "Automated sending requires a 16-character Gmail App Password configured in .env (SMTP_PASS).",
      mailtoUrl,
    };
  }

  try {
    const isGmail = smtpHost.includes("gmail") || (smtpUser && smtpUser.includes("@gmail.com"));

    const transporter = nodemailer.createTransport(
      isGmail
        ? {
            service: "gmail",
            auth: {
              user: smtpUser,
              pass: smtpPass.replace(/\s+/g, ""), // strip any spaces in app password
            },
          }
        : {
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          }
    );

    const fromAddress = process.env.SMTP_FROM || `"${data.auditorName || "CA Keerthiga Sri J.M."}" <${smtpUser}>`;
    const icsContent = buildIcsCalendarContent(data);

    const isOrganizerIncluded = validAttendees.some(
      (a) => a.toLowerCase() === smtpUser.toLowerCase()
    );

    const info: any = await transporter.sendMail({
      from: fromAddress,
      to: validAttendees,
      cc: isOrganizerIncluded ? undefined : [smtpUser],
      subject: `Invitation: CA Audit Consultation — ${data.topic}`,
      text:
        `CA Audit Consultation Invitation\n\n` +
        `Topic: ${data.topic}\n` +
        `Date & Time: ${formatMeetingTime(data.start, data.timeZone)} (${data.timeZone || "Asia/Kolkata"})\n` +
        `Duration: ${data.durationMinutes} Minutes\n` +
        `Auditor: ${data.auditorName || "CA Keerthiga Sri J.M."} (${data.auditorFirm || "J.M. & Associates"})\n\n` +
        `Join Google Meet:\n${data.meetLink}\n\n` +
        `Attendees: ${validAttendees.join(", ")}\n\n` +
        `Calendar Sync: This invitation has been automatically registered to your Google Calendar.`,
      html: buildMeetingEmailHtml(data),
      icalEvent: {
        filename: "invite.ics",
        method: "REQUEST",
        content: icsContent,
      },
      alternatives: [
        {
          contentType: 'text/calendar; charset="utf-8"; method=REQUEST',
          content: Buffer.from(icsContent, "utf-8"),
        },
      ],
    });

    console.error(`[lib/email] Successfully sent invite email to ${validAttendees.join(", ")} (Message ID: ${info?.messageId || "ok"})`);

    return {
      success: true,
      sentTo: validAttendees,
      messageId: info.messageId,
      reason: "sent",
      mailtoUrl,
    };
  } catch (err: any) {
    console.error("[lib/email] Failed to send email via SMTP:", err?.message || err);
    return {
      success: false,
      sentTo: [],
      reason: "failed",
      error: err?.message || "Failed to send email via SMTP",
      mailtoUrl,
    };
  }
}

/** Verifies SMTP connection and optionally sends a test email */
export async function verifySmtpConnection(testRecipient?: string): Promise<{ success: boolean; error?: string; message?: string }> {
  reloadEnvFile();
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.AUDITOR_EMAIL || "keerthigasri04@gmail.com";
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);

  if (!smtpPass || smtpPass.trim() === "" || smtpPass.includes("your-app-password")) {
    return {
      success: false,
      error: "SMTP_PASS is empty. Please provide a 16-character Gmail App Password.",
    };
  }

  const isGmail = smtpHost.includes("gmail") || (smtpUser && smtpUser.includes("@gmail.com"));

  const transporter = nodemailer.createTransport(
    isGmail
      ? {
          service: "gmail",
          auth: {
            user: smtpUser,
            pass: smtpPass.replace(/\s+/g, ""),
          },
        }
      : {
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        }
  );

  try {
    await transporter.verify();
    if (testRecipient && testRecipient.includes("@")) {
      await transporter.sendMail({
        from: `"${process.env.AUDITOR_NAME || "CA Keerthiga Sri J.M."}" <${smtpUser}>`,
        to: testRecipient,
        subject: "Test Verification: CA Audit Chatbot Automated Email Active",
        text: "This automated email confirms that Gmail SMTP dispatch is active and ready to deliver meeting invitations in the background.",
      });
    }
    return {
      success: true,
      message: `Verified successfully! Automated emails will be dispatched from ${smtpUser}.`,
    };
  } catch (err: any) {
    console.error("[lib/email] SMTP verification failed:", err?.message || err);
    return {
      success: false,
      error: err?.message || "Google rejected the password. Please verify that 2-Step Verification is active and a 16-character App Password is used.",
    };
  }
}
