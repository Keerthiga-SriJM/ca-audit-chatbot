import { google } from "googleapis";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseLocalDateToUtc } from "./email";

export interface CalendarEventParams {
  topic: string;
  start: string; // YYYY-MM-DDTHH:mm:ss
  durationMinutes: number;
  attendees: string[];
  meetLink?: string | null;
  timeZone?: string;
  auditorName?: string;
  auditorFirm?: string;
  auditorEmail?: string;
}

export interface UpdateCalendarEventParams {
  eventId?: string; // Optional: if omitted, updates most recent or upcoming CA Audit event
  topic?: string;
  start?: string; // YYYY-MM-DDTHH:mm:ss
  durationMinutes?: number;
  attendees?: string[]; // If supplied, replaces or sets full attendee list
  addAttendees?: string[]; // Specific attendee emails to append to existing list
  meetLink?: string | null;
  timeZone?: string;
  auditorName?: string;
  auditorFirm?: string;
  auditorEmail?: string;
}

export interface CalendarEventResult {
  success: boolean;
  syncedViaApi: boolean;
  eventId?: string;
  htmlLink: string; // Direct Google Calendar event URL
  calendarWebUrl: string; // Universal 1-click template URL with all attendees for participant browsers
  meetLink: string;
  attendees?: string[];
  updatedAt?: string;
  error?: string;
}

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
      console.error("[lib/calendar] Failed to reload .env:", e?.message);
    }
  }
  return envMap;
}

/** Returns Google OAuth client credentials if present in .env or credentials.json */
export function getGoogleCredentials(): {
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  isTokenValid: boolean;
} {
  reloadEnvFile();

  let clientId = process.env.GOOGLE_CLIENT_ID || null;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET || null;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || null;

  // Prefer credentials.json if present
  const credPath = path.resolve(process.cwd(), "credentials.json");
  if (fs.existsSync(credPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(credPath, "utf-8"));
      const inst = creds.installed || creds.web;
      if (inst?.client_id) {
        clientId = inst.client_id;
        clientSecret = inst.client_secret;
      }
    } catch { }
  }

  const isTokenValid = Boolean(
    refreshToken &&
    !refreshToken.includes("apps.googleusercontent.com") &&
    !refreshToken.includes("your_oauth_refresh_token") &&
    refreshToken.length > 20
  );

  return { clientId, clientSecret, refreshToken, isTokenValid };
}

/** Helper to clean and validate email strings */
export function sanitizeEmailList(emails: (string | null | undefined)[]): string[] {
  const valid = new Set<string>();
  for (const raw of emails) {
    if (!raw) continue;
    const clean = raw.trim().toLowerCase();
    if (clean === "keerthigasrijm@gmail.com") continue;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      valid.add(clean);
    }
  }
  return Array.from(valid);
}

/** Generates a proper, dedicated Google Meet room link (e.g. https://meet.google.com/xxx-yyyy-zzz) */
export function generateDedicatedMeetLink(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const p = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `https://meet.google.com/${p(3)}-${p(4)}-${p(3)}`;
}

/** Formats a universal pre-filled Google Calendar Event URL with exact date, time, attendees, and Google Meet */
export function buildGoogleCalendarWebUrl(
  params: {
    topic: string;
    start: string;
    durationMinutes: number;
    attendees?: string[];
    timeZone?: string;
    auditorName?: string;
    auditorFirm?: string;
    auditorEmail?: string;
  },
  meetLink: string
): string {
  const tz = params.timeZone || process.env.TIMEZONE || "Asia/Kolkata";
  const startUtc = parseLocalDateToUtc(params.start, tz);
  const endUtc = new Date(startUtc.getTime() + params.durationMinutes * 60_000);

  const cleanIso = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const dtStart = cleanIso(startUtc);
  const dtEnd = cleanIso(endUtc);

  const title = `CA Audit Consultation: ${params.topic}`;
  const auditorName = params.auditorName || process.env.AUDITOR_NAME || "CA Keerthiga Sri J.M.";
  const auditorFirm = params.auditorFirm || process.env.AUDITOR_FIRM || "J.M. & Associates Chartered Accountants";
  const auditorEmail = params.auditorEmail || process.env.AUDITOR_EMAIL || "keerthigasri04@gmail.com";

  const allAttendees = sanitizeEmailList([...(params.attendees || []), auditorEmail]);

  const details =
    `CA Audit Consultation\n` +
    `Topic: ${params.topic}\n` +
    `Duration: ${params.durationMinutes} minutes\n` +
    `Host / Lead Auditor: ${auditorName} (${auditorFirm})\n` +
    `Host Email: ${auditorEmail}\n` +
    `Google Meet: ${meetLink}\n\n` +
    `Invited Participants: ${allAttendees.join(", ")}`;

  let url =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(title).replace(/\(/g, "%28").replace(/\)/g, "%29")}` +
    `&dates=${dtStart}/${dtEnd}` +
    `&ctz=${encodeURIComponent(tz)}` +
    `&location=${encodeURIComponent(meetLink)}` +
    `&details=${encodeURIComponent(details).replace(/\(/g, "%28").replace(/\)/g, "%29")}`;

  if (allAttendees.length > 0) {
    url += `&add=${encodeURIComponent(allAttendees.join(","))}`;
  }

  return url;
}

/**
 * Searches Google Calendar for the most relevant or recent CA Audit meeting
 */
export async function findLatestCalendarEvent(query?: string): Promise<{
  id: string;
  summary: string;
  start?: string;
  end?: string;
  meetLink?: string;
  attendees: string[];
} | null> {
  const { clientId, clientSecret, refreshToken, isTokenValid } = getGoogleCredentials();
  if (!clientId || !clientSecret || !isTokenValid || !refreshToken) {
    return null;
  }

  try {
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: "v3", auth });

    // Look for events from 14 days ago up to future
    const timeMin = new Date(Date.now() - 14 * 86400000).toISOString();
    const res = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
      timeMin,
      maxResults: 15,
      singleEvents: true,
      orderBy: "startTime",
    });

    const items = res.data.items || [];
    if (items.length === 0) return null;

    let target = items.find((item) => {
      const summary = item.summary || "";
      if (query && summary.toLowerCase().includes(query.toLowerCase())) return true;
      return summary.startsWith("CA Audit");
    });

    // Fallback to the latest item in the list
    if (!target) {
      target = items[items.length - 1];
    }

    if (!target || !target.id) return null;

    const meetLink =
      target.hangoutLink ||
      target.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")?.uri ||
      target.location ||
      "https://meet.google.com/new";

    const attendees = sanitizeEmailList((target.attendees || []).map((a) => a.email));

    return {
      id: target.id,
      summary: target.summary || "CA Audit Consultation",
      start: (target.start?.dateTime || target.start?.date) ?? undefined,
      end: (target.end?.dateTime || target.end?.date) ?? undefined,
      meetLink,
      attendees,
    };
  } catch (err: any) {
    console.error("[lib/calendar] findLatestCalendarEvent error:", err?.message || err);
    return null;
  }
}

/**
 * Creates an event in Google Calendar.
 * Inserts the event via Google Calendar v3 API with sendUpdates="all"
 * so that Google automatically dispatches calendar invitations and places
 * the event directly on all participants' Google Calendars.
 */
export async function scheduleGoogleCalendarEvent(
  params: CalendarEventParams
): Promise<CalendarEventResult> {
  const tz = params.timeZone || process.env.TIMEZONE || "Asia/Kolkata";
  const startUtc = parseLocalDateToUtc(params.start, tz);
  const endUtc = new Date(startUtc.getTime() + params.durationMinutes * 60_000);

  let meetLink = params.meetLink || null;
  const envMeet = (process.env.AUDITOR_MEET_LINK || "").trim();
  const isValidEnvMeet =
    envMeet.startsWith("https://meet.google.com/") &&
    envMeet !== "https://meet.google.com/new" &&
    !envMeet.includes("ca-audit-consultation");

  if (!meetLink || meetLink === "https://meet.google.com/new" || meetLink.includes("ca-audit-consultation")) {
    meetLink = isValidEnvMeet ? envMeet : generateDedicatedMeetLink();
  }

  const auditorName = params.auditorName || process.env.AUDITOR_NAME || "CA Keerthiga Sri J.M.";
  const auditorFirm = params.auditorFirm || process.env.AUDITOR_FIRM || "J.M. & Associates Chartered Accountants";
  const auditorEmail = params.auditorEmail || process.env.AUDITOR_EMAIL || "keerthigasri04@gmail.com";

  const allAttendees = sanitizeEmailList([...(params.attendees || []), auditorEmail]);
  const webUrl = buildGoogleCalendarWebUrl(
    {
      topic: params.topic,
      start: params.start,
      durationMinutes: params.durationMinutes,
      attendees: allAttendees,
      timeZone: tz,
      auditorName,
      auditorFirm,
      auditorEmail,
    },
    meetLink
  );

  const { clientId, clientSecret, refreshToken, isTokenValid } = getGoogleCredentials();

  // 1) Direct Google Calendar API Insert
  if (clientId && clientSecret && isTokenValid && refreshToken) {
    try {
      const auth = new google.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials({ refresh_token: refreshToken });
      const calendar = google.calendar({ version: "v3", auth });

      const attendeeObjects = allAttendees.map((email) => ({
        email,
        responseStatus: email === auditorEmail ? "accepted" : "needsAction",
      }));

      const { data } = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
        conferenceDataVersion: 1,
        sendUpdates: "all", // Updates and notifies all attendees' Google Calendars
        requestBody: {
          summary: `CA Audit: ${params.topic}`,
          description:
            `CA Audit Consultation\n` +
            `Topic: ${params.topic}\n` +
            `Duration: ${params.durationMinutes} mins\n` +
            `Lead Auditor: ${auditorName} (${auditorFirm})\n` +
            `Auditor Email: ${auditorEmail}\n` +
            `Google Meet Link: ${meetLink}\n\n` +
            `All Participants: ${allAttendees.join(", ")}`,
          start: { dateTime: startUtc.toISOString(), timeZone: tz },
          end: { dateTime: endUtc.toISOString(), timeZone: tz },
          location: meetLink,
          attendees: attendeeObjects,
          conferenceData: {
            createRequest: {
              requestId: randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        },
      });

      let liveMeet =
        data.hangoutLink ||
        data.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")?.uri ||
        meetLink;

      if (!liveMeet || liveMeet === "https://meet.google.com/new" || liveMeet.includes("ca-audit-consultation")) {
        liveMeet = meetLink;
      }

      const universalUrl = buildGoogleCalendarWebUrl(
        {
          topic: params.topic,
          start: params.start,
          durationMinutes: params.durationMinutes,
          attendees: allAttendees,
          timeZone: tz,
          auditorName,
          auditorFirm,
          auditorEmail,
        },
        liveMeet
      );

      console.error(
        `[lib/calendar] Successfully inserted event into Google Calendar (ID: ${data.id}, HTML: ${data.htmlLink}) for participants: ${allAttendees.join(", ")}`
      );

      return {
        success: true,
        syncedViaApi: true,
        eventId: data.id || undefined,
        htmlLink: data.htmlLink || universalUrl,
        calendarWebUrl: universalUrl,
        meetLink: liveMeet,
        attendees: allAttendees,
        updatedAt: new Date().toISOString(),
      };
    } catch (apiErr: any) {
      console.error("[lib/calendar] Google Calendar API insert failed:", apiErr?.message || apiErr);
    }
  }

  // 2) Fallback to Web Action URL
  return {
    success: true,
    syncedViaApi: false,
    htmlLink: webUrl,
    calendarWebUrl: webUrl,
    meetLink,
    attendees: allAttendees,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Updates an existing event in Google Calendar for all participants.
 * Calls calendar.events.patch with sendUpdates="all", so that Google
 * updates the event on every attendee's calendar and dispatches update notifications.
 */
export async function updateGoogleCalendarEvent(
  params: UpdateCalendarEventParams
): Promise<CalendarEventResult> {
  const tz = params.timeZone || process.env.TIMEZONE || "Asia/Kolkata";
  const auditorName = params.auditorName || process.env.AUDITOR_NAME || "CA Keerthiga Sri J.M.";
  const auditorFirm = params.auditorFirm || process.env.AUDITOR_FIRM || "J.M. & Associates Chartered Accountants";
  const auditorEmail = params.auditorEmail || process.env.AUDITOR_EMAIL || "keerthigasri04@gmail.com";

  const { clientId, clientSecret, refreshToken, isTokenValid } = getGoogleCredentials();

  let targetEventId = params.eventId || null;
  let existingAttendees: string[] = [];
  let existingSummary = params.topic || "CA Audit Consultation";
  let existingMeetLink = params.meetLink || null;
  let existingStart = params.start || new Date().toISOString().slice(0, 19);
  let durationMins = params.durationMinutes || 30;

  // Direct Google Calendar API Update
  if (clientId && clientSecret && isTokenValid && refreshToken) {
    try {
      const auth = new google.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials({ refresh_token: refreshToken });
      const calendar = google.calendar({ version: "v3", auth });

      // If eventId wasn't provided, find the most relevant upcoming/recent event
      if (!targetEventId) {
        const found = await findLatestCalendarEvent(params.topic);
        if (found) {
          targetEventId = found.id;
          existingAttendees = found.attendees;
          if (!params.topic && found.summary) existingSummary = found.summary.replace(/^CA Audit:\s*/, "");
          if (!existingMeetLink && found.meetLink) existingMeetLink = found.meetLink;
          if (!params.start && found.start) existingStart = found.start.slice(0, 19);
        }
      }

      if (targetEventId) {
        // Fetch existing event details if not already fetched
        try {
          const cur = await calendar.events.get({
            calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
            eventId: targetEventId,
          });
          if (cur.data) {
            existingAttendees = sanitizeEmailList((cur.data.attendees || []).map((a) => a.email));
            if (!params.topic && cur.data.summary) {
              existingSummary = cur.data.summary.replace(/^CA Audit:\s*/, "");
            }
            if (!existingMeetLink) {
              existingMeetLink =
                cur.data.hangoutLink ||
                cur.data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri ||
                cur.data.location ||
                null;
            }
            if (!params.start && cur.data.start?.dateTime) {
              existingStart = cur.data.start.dateTime.slice(0, 19);
            }
          }
        } catch (fetchErr: any) {
          console.error("[lib/calendar] Error fetching existing event for patch:", fetchErr?.message);
        }
      }

      const mergedAttendees = sanitizeEmailList([
        ...existingAttendees,
        ...(params.attendees || []),
        ...(params.addAttendees || []),
        auditorEmail,
      ]);

      const attendeeObjects = mergedAttendees.map((email) => ({
        email,
        responseStatus: email === auditorEmail ? "accepted" : "needsAction",
      }));

      const finalTopic = params.topic || existingSummary;
      const finalMeet = existingMeetLink || process.env.AUDITOR_MEET_LINK || "https://meet.google.com/new";

      const patchBody: any = {
        summary: `CA Audit: ${finalTopic}`,
        description:
          `CA Audit Consultation\n` +
          `Topic: ${finalTopic}\n` +
          `Duration: ${durationMins} mins\n` +
          `Lead Auditor: ${auditorName} (${auditorFirm})\n` +
          `Auditor Email: ${auditorEmail}\n` +
          `Google Meet Link: ${finalMeet}\n\n` +
          `All Participants: ${mergedAttendees.join(", ")}`,
        location: finalMeet,
        attendees: attendeeObjects,
      };

      if (params.start) {
        const startUtc = parseLocalDateToUtc(params.start, tz);
        const endUtc = new Date(startUtc.getTime() + durationMins * 60_000);
        patchBody.start = { dateTime: startUtc.toISOString(), timeZone: tz };
        patchBody.end = { dateTime: endUtc.toISOString(), timeZone: tz };
      }

      let resData: any = null;
      if (targetEventId) {
        const { data } = await calendar.events.patch({
          calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
          eventId: targetEventId,
          sendUpdates: "all", // CRITICAL: updates Google Calendar for ALL participants
          requestBody: patchBody,
        });
        resData = data;
        console.error(
          `[lib/calendar] Successfully updated event in Google Calendar (ID: ${data.id}) for all participants: ${mergedAttendees.join(", ")}`
        );
      } else {
        // No existing event found, schedule as new
        return await scheduleGoogleCalendarEvent({
          topic: finalTopic,
          start: existingStart,
          durationMinutes: durationMins,
          attendees: mergedAttendees,
          meetLink: finalMeet,
          timeZone: tz,
          auditorName,
          auditorFirm,
          auditorEmail,
        });
      }

      const liveMeet =
        resData.hangoutLink ||
        resData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")?.uri ||
        finalMeet;

      const universalUrl = buildGoogleCalendarWebUrl(
        {
          topic: finalTopic,
          start: existingStart,
          durationMinutes: durationMins,
          attendees: mergedAttendees,
          timeZone: tz,
          auditorName,
          auditorFirm,
          auditorEmail,
        },
        liveMeet
      );

      return {
        success: true,
        syncedViaApi: true,
        eventId: resData.id || targetEventId,
        htmlLink: resData.htmlLink || universalUrl,
        calendarWebUrl: universalUrl,
        meetLink: liveMeet,
        attendees: mergedAttendees,
        updatedAt: new Date().toISOString(),
      };
    } catch (apiErr: any) {
      console.error("[lib/calendar] Google Calendar API update failed:", apiErr?.message || apiErr);
    }
  }

  // Fallback to Web Action URL
  const allMerged = sanitizeEmailList([
    ...existingAttendees,
    ...(params.attendees || []),
    ...(params.addAttendees || []),
    auditorEmail,
  ]);

  const webUrl = buildGoogleCalendarWebUrl(
    {
      topic: params.topic || existingSummary,
      start: params.start || existingStart,
      durationMinutes: durationMins,
      attendees: allMerged,
      timeZone: tz,
      auditorName,
      auditorFirm,
      auditorEmail,
    },
    existingMeetLink || "https://meet.google.com/new"
  );

  return {
    success: true,
    syncedViaApi: false,
    eventId: targetEventId || undefined,
    htmlLink: webUrl,
    calendarWebUrl: webUrl,
    meetLink: existingMeetLink || "https://meet.google.com/new",
    attendees: allMerged,
    updatedAt: new Date().toISOString(),
  };
}
