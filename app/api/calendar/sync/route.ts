import { NextRequest } from "next/server";
import {
  scheduleGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  findLatestCalendarEvent,
  CalendarEventParams,
  UpdateCalendarEventParams,
} from "@/lib/calendar";
import { apiResponse, apiError, handleCorsPreflight } from "@/lib/cors";
import { verifyApiKeyRequest } from "@/lib/api-keys";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyApiKeyRequest(req);
    if (!auth.authorized) {
      return apiError(auth.reason || "Unauthorized", 401);
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q") || undefined;
    const latest = await findLatestCalendarEvent(q);
    return apiResponse({ success: true, event: latest });
  } catch (err: any) {
    return apiError(err?.message || "Failed to search calendar events", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyApiKeyRequest(req);
    if (!auth.authorized) {
      return apiError(auth.reason || "Unauthorized", 401);
    }

    const body = (await req.json()) as Partial<CalendarEventParams & UpdateCalendarEventParams> & {
      action?: "create" | "update";
    };

    const isUpdate =
      body.action === "update" ||
      Boolean(body.eventId) ||
      Boolean(body.addAttendees && body.addAttendees.length > 0);

    if (isUpdate) {
      const result = await updateGoogleCalendarEvent({
        eventId: body.eventId,
        topic: body.topic,
        start: body.start,
        durationMinutes: body.durationMinutes,
        attendees: body.attendees,
        addAttendees: body.addAttendees,
        meetLink: body.meetLink,
        timeZone: body.timeZone || process.env.TIMEZONE || "Asia/Kolkata",
        auditorName: body.auditorName || process.env.AUDITOR_NAME,
        auditorFirm: body.auditorFirm || process.env.AUDITOR_FIRM,
        auditorEmail: body.auditorEmail || process.env.AUDITOR_EMAIL,
      });
      return apiResponse(result);
    }

    if (!body.topic || !body.start) {
      // If missing topic or start, attempt updating latest event
      const result = await updateGoogleCalendarEvent({
        topic: body.topic,
        start: body.start,
        durationMinutes: body.durationMinutes,
        attendees: body.attendees,
        addAttendees: body.addAttendees,
        meetLink: body.meetLink,
        timeZone: body.timeZone || process.env.TIMEZONE || "Asia/Kolkata",
      });
      return apiResponse(result);
    }

    const attendees = (body.attendees || []).filter((e) => e && e.includes("@"));

    const result = await scheduleGoogleCalendarEvent({
      topic: body.topic,
      start: body.start,
      durationMinutes: body.durationMinutes || 30,
      attendees,
      meetLink: body.meetLink,
      timeZone: body.timeZone || process.env.TIMEZONE || "Asia/Kolkata",
      auditorName: body.auditorName || process.env.AUDITOR_NAME,
      auditorFirm: body.auditorFirm || process.env.AUDITOR_FIRM,
      auditorEmail: body.auditorEmail || process.env.AUDITOR_EMAIL,
    });

    return apiResponse(result);
  } catch (err: any) {
    console.error("API /api/calendar/sync error:", err);
    return apiError(err?.message || "Failed to schedule or update calendar event", 500);
  }
}
