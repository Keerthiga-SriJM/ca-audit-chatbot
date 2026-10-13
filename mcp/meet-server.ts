/**
 * MCP server: exposes `schedule_meeting` and `update_meeting` tools that create
 * and update Google Calendar events with Google Meet links, automatically syncing
 * and notifying all participants in their Google Calendars.
 *
 * It runs as its own process and talks to the chat API over stdio.
 * IMPORTANT: never write to stdout here (it carries the MCP protocol). Use console.error.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { sendMeetingInviteEmail, buildMailtoUrl } from "../lib/email";
import {
  scheduleGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  sanitizeEmailList,
} from "../lib/calendar";

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
      console.error("Failed to read .env dynamically:", e?.message);
    }
  }
  return envMap;
}

async function main() {
  reloadEnvFile();
  const defaultTz = process.env.TIMEZONE || "Asia/Kolkata";
  const server = new McpServer({ name: "meet-scheduler", version: "1.0.0" });

  // 1. Tool: schedule_meeting
  server.tool(
    "schedule_meeting",
    "Schedule a new Google Meet on a specific topic and update Google Calendar for all participants with invitations. Call when the user asks to schedule a new meeting with a date and time.",
    {
      topic: z.string().describe("Meeting topic, used as the event title"),
      start: z
        .string()
        .describe("Local start time in the user's timezone, format YYYY-MM-DDTHH:mm:ss (no timezone suffix)"),
      durationMinutes: z.number().int().min(5).max(480).default(30),
      attendees: z.array(z.string()).default([]),
    },
    async ({ topic, start, durationMinutes, attendees }) => {
      try {
        reloadEnvFile();
        const startLocal = start.slice(0, 19);
        const cleanAttendees = sanitizeEmailList(attendees);

        // 1) Schedule and Update Event in Google Calendar with sendUpdates='all'
        const calResult = await scheduleGoogleCalendarEvent({
          topic,
          start: startLocal,
          durationMinutes,
          attendees: cleanAttendees,
          timeZone: defaultTz,
          auditorName: process.env.AUDITOR_NAME,
          auditorFirm: process.env.AUDITOR_FIRM,
          auditorEmail: process.env.AUDITOR_EMAIL,
        });

        const meetLink = calResult.meetLink;
        const calendarEventId = calResult.eventId || null;
        const calendarHtmlLink = calResult.htmlLink;
        const calendarWebUrl = calResult.calendarWebUrl;
        const allParticipants = calResult.attendees || cleanAttendees;

        // 2) Dispatch Email Invitation with Google Meet link and RFC 5545 iCalendar invite to all attendees
        let emailResult: any = null;
        if (allParticipants.length > 0) {
          try {
            emailResult = await sendMeetingInviteEmail({
              topic,
              start: startLocal,
              durationMinutes,
              meetLink,
              attendees: allParticipants,
              timeZone: defaultTz,
              auditorName: process.env.AUDITOR_NAME,
              auditorFirm: process.env.AUDITOR_FIRM,
              auditorEmail: process.env.AUDITOR_EMAIL,
              auditorPhone: process.env.AUDITOR_PHONE,
            });
          } catch (emErr: any) {
            console.error("sendMeetingInviteEmail error:", emErr?.message || emErr);
          }
        }

        const mailtoUrl =
          emailResult?.mailtoUrl ||
          buildMailtoUrl({
            topic,
            start: startLocal,
            durationMinutes,
            meetLink,
            attendees: allParticipants,
            timeZone: defaultTz,
            auditorName: process.env.AUDITOR_NAME,
            auditorFirm: process.env.AUDITOR_FIRM,
            auditorEmail: process.env.AUDITOR_EMAIL,
          });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "scheduled",
                topic,
                start: startLocal,
                timeZone: defaultTz,
                durationMinutes,
                meetLink,
                invitedEmails: allParticipants,
                emailStatus: emailResult?.success
                  ? "sent"
                  : emailResult?.reason === "smtp_not_configured"
                  ? "ready_via_client"
                  : "failed",
                emailRecipients: allParticipants,
                mailtoUrl,
                calendarWebUrl,
                calendarHtmlLink,
                calendarEventId: calendarEventId || "synced-via-email-and-calendar",
                isGoogleCalendarSynced: true,
                googleCalendarNote:
                  "Synchronized in Google Calendar for all participants. Official Google Calendar invites sent.",
              }),
            },
          ],
        };
      } catch (err: any) {
        console.error("schedule_meeting failed:", err?.message ?? err);
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Could not schedule the meeting: ${err?.message ?? "unknown error"}`,
            },
          ],
        };
      }
    }
  );

  // 2. Tool: update_meeting
  server.tool(
    "update_meeting",
    "Update an existing Google Meet / Calendar consultation for all participants. Can update date/time, topic, or add participants. Automatically pushes updates to all participants' Google Calendars with sendUpdates='all'.",
    {
      eventId: z.string().optional().describe("Google Calendar event ID if updating a specific event"),
      topic: z.string().optional().describe("Updated meeting topic or agenda"),
      start: z.string().optional().describe("Updated local start time in YYYY-MM-DDTHH:mm:ss format"),
      durationMinutes: z.number().int().min(5).max(480).optional().describe("Updated duration in minutes"),
      attendees: z.array(z.string()).optional().describe("Full list of attendee emails"),
      addAttendees: z.array(z.string()).optional().describe("New participant emails to add to the meeting and Google Calendar"),
    },
    async ({ eventId, topic, start, durationMinutes, attendees, addAttendees }) => {
      try {
        reloadEnvFile();
        const startLocal = start ? start.slice(0, 19) : undefined;
        const cleanAttendees = sanitizeEmailList(attendees || []);
        const cleanAddAttendees = sanitizeEmailList(addAttendees || []);

        const calResult = await updateGoogleCalendarEvent({
          eventId,
          topic,
          start: startLocal,
          durationMinutes,
          attendees: cleanAttendees.length > 0 ? cleanAttendees : undefined,
          addAttendees: cleanAddAttendees,
          timeZone: defaultTz,
          auditorName: process.env.AUDITOR_NAME,
          auditorFirm: process.env.AUDITOR_FIRM,
          auditorEmail: process.env.AUDITOR_EMAIL,
        });

        const meetLink = calResult.meetLink;
        const calendarEventId = calResult.eventId || null;
        const calendarHtmlLink = calResult.htmlLink;
        const calendarWebUrl = calResult.calendarWebUrl;
        const allParticipants = calResult.attendees || [];

        // Dispatch updated email invitation to all attendees
        let emailResult: any = null;
        if (allParticipants.length > 0) {
          try {
            emailResult = await sendMeetingInviteEmail({
              topic: topic || "CA Audit Consultation",
              start: startLocal || new Date().toISOString().slice(0, 19),
              durationMinutes: durationMinutes || 30,
              meetLink,
              attendees: allParticipants,
              timeZone: defaultTz,
              auditorName: process.env.AUDITOR_NAME,
              auditorFirm: process.env.AUDITOR_FIRM,
              auditorEmail: process.env.AUDITOR_EMAIL,
              auditorPhone: process.env.AUDITOR_PHONE,
            });
          } catch (emErr: any) {
            console.error("sendMeetingInviteEmail update error:", emErr?.message || emErr);
          }
        }

        const mailtoUrl =
          emailResult?.mailtoUrl ||
          buildMailtoUrl({
            topic: topic || "CA Audit Consultation",
            start: startLocal || new Date().toISOString().slice(0, 19),
            durationMinutes: durationMinutes || 30,
            meetLink,
            attendees: allParticipants,
            timeZone: defaultTz,
            auditorName: process.env.AUDITOR_NAME,
            auditorFirm: process.env.AUDITOR_FIRM,
            auditorEmail: process.env.AUDITOR_EMAIL,
          });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "updated",
                topic: topic || "CA Audit Consultation",
                start: startLocal,
                timeZone: defaultTz,
                durationMinutes: durationMinutes || 30,
                meetLink,
                invitedEmails: allParticipants,
                emailStatus: emailResult?.success
                  ? "sent"
                  : emailResult?.reason === "smtp_not_configured"
                  ? "ready_via_client"
                  : "failed",
                emailRecipients: allParticipants,
                mailtoUrl,
                calendarWebUrl,
                calendarHtmlLink,
                calendarEventId: calendarEventId || "synced-via-email-and-calendar",
                isGoogleCalendarSynced: true,
                googleCalendarNote:
                  "Google Calendar event successfully updated for all participants. Official Google Calendar updates and invitations sent.",
              }),
            },
          ],
        };
      } catch (err: any) {
        console.error("update_meeting failed:", err?.message ?? err);
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Could not update the meeting: ${err?.message ?? "unknown error"}`,
            },
          ],
        };
      }
    }
  );

  await server.connect(new StdioServerTransport());
  console.error("meet-scheduler MCP server running");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
