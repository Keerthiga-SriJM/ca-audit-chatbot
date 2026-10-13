import { NextRequest } from "next/server";
import { sendMeetingInviteEmail, MeetingEmailData } from "@/lib/email";
import { scheduleGoogleCalendarEvent } from "@/lib/calendar";
import { apiResponse, apiError, handleCorsPreflight } from "@/lib/cors";
import { verifyApiKeyRequest } from "@/lib/api-keys";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyApiKeyRequest(req);
    if (!auth.authorized) {
      return apiError(auth.reason || "Unauthorized", 401);
    }

    const body = (await req.json()) as Partial<MeetingEmailData>;

    if (!body.topic || !body.start || !body.meetLink) {
      return apiError("Missing required meeting fields (topic, start, meetLink).", 400);
    }

    const attendees = (body.attendees || []).filter((e) => e && e.includes("@"));
    if (attendees.length === 0) {
      return apiError("No valid attendee emails provided.", 400);
    }

    const timeZone = body.timeZone || process.env.TIMEZONE || "Asia/Kolkata";
    const auditorName = body.auditorName || process.env.AUDITOR_NAME || "CA Keerthiga Sri J.M.";
    const auditorFirm = body.auditorFirm || process.env.AUDITOR_FIRM || "J.M. & Associates Chartered Accountants";
    const auditorEmail = body.auditorEmail || process.env.AUDITOR_EMAIL || "keerthigasri04@gmail.com";
    const auditorPhone = body.auditorPhone || process.env.AUDITOR_PHONE || "+91 96555 28291";

    // 1) Sync directly with Google Calendar
    const calResult = await scheduleGoogleCalendarEvent({
      topic: body.topic,
      start: body.start,
      durationMinutes: body.durationMinutes || 30,
      attendees,
      meetLink: body.meetLink,
      timeZone,
      auditorName,
      auditorFirm,
      auditorEmail,
    });

    const finalMeetLink = calResult.meetLink || body.meetLink;

    // 2) Send meeting invitation email with RFC 5545 iCalendar payload
    const emailResult = await sendMeetingInviteEmail({
      topic: body.topic,
      start: body.start,
      durationMinutes: body.durationMinutes || 30,
      meetLink: finalMeetLink,
      attendees,
      timeZone,
      auditorName,
      auditorFirm,
      auditorEmail,
      auditorPhone,
    });

    return apiResponse({
      ...emailResult,
      calendar: calResult,
      calendarWebUrl: calResult.htmlLink,
      meetLink: finalMeetLink,
    });
  } catch (error: any) {
    console.error("API /api/email/send error:", error);
    return apiError(error?.message || "Failed to process email invite request.", 500);
  }
}
