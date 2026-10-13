import {
  scheduleGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  buildGoogleCalendarWebUrl,
  sanitizeEmailList,
  CalendarEventResult,
} from "./calendar";
import { sendMeetingInviteEmail, formatMeetingTime } from "./email";
import { getAuditorProfile } from "./langchain";

export interface ParsedMeetingIntent {
  isMeetingQuery: boolean;
  isUpdate: boolean;
  hasDate: boolean;
  hasTime: boolean;
  startIso?: string; // YYYY-MM-DDTHH:mm:ss
  topic: string;
  durationMinutes: number;
  extraAttendees: string[];
}

/**
 * Natural language parser for meeting scheduling & updates.
 * Correctly parses relative dates, explicit dates, 12-hour/24-hour time,
 * participant emails, topics, and duration.
 */
export function parseMeetingIntent(
  query: string,
  timeZone: string = process.env.TIMEZONE || "Asia/Kolkata",
  history?: Array<{ role: string; content: string }>
): ParsedMeetingIntent {
  let isMeeting =
    /(meet|schedul|calendar|call|consult|reschedul|appointment|agenda|attendee|invite|sync)/i.test(
      query
    );

  // If query doesn't explicitly mention meeting, but previous assistant message was asking for date/time
  if (!isMeeting && history && history.length > 0) {
    const lastAssistant = history.filter((m) => m.role === "assistant").at(-1)?.content || "";
    const isAwaitingDateTime = /(preferred\s+(?:date|time)|schedule\s+(?:the\s+|a\s+)?google\s+meet|provide\s+(?:me\s+)?(?:the\s+)?date|date\s+and\s+time|date,\s*time)/i.test(
      lastAssistant
    );
    const hasDateTimeCandidate =
      /(?:tomorrow|today|yesterday|day after tomorrow|\bam\b|\bpm\b|\bat\s+\d|\d{1,2}:\d{2}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2})/i.test(
        query
      );
    if (isAwaitingDateTime && hasDateTimeCandidate) {
      isMeeting = true;
    }
  }

  if (!isMeeting) {
    return {
      isMeetingQuery: false,
      isUpdate: false,
      hasDate: false,
      hasTime: false,
      topic: "CA Audit Consultation",
      durationMinutes: 30,
      extraAttendees: [],
    };
  }

  const isUpdate =
    /(update|reschedul|change|add participant|add attendee|sync\s+google\s+calendar)/i.test(
      query
    ) && !/schedule a (?:new )?google meet/i.test(query);

  // Extract attendee emails mentioned in the prompt (e.g., palanitce@gmail.com)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const extraAttendees = Array.from(new Set(query.match(emailRegex) || [])).map((e) =>
    e.toLowerCase()
  );

  // Extract duration (e.g., "for 45 minutes", "1 hour", "for 60 mins")
  let durationMinutes = 30;
  const durMatch = query.match(/(?:for\s+)?(\d+(?:\.\d+)?)\s*(min|minute|hour|hr)s?\b/i);
  if (durMatch) {
    const val = parseFloat(durMatch[1]);
    if (/hour|hr/i.test(durMatch[2])) {
      durationMinutes = Math.round(val * 60);
    } else {
      durationMinutes = Math.round(val);
    }
  }

  // Extract topic
  let topic = "10-Year Audit Review & Consultation";
  const topicMatch = query.match(
    /(?:about|regarding|on|topic[:\s]+)(?:the\s+)?([^,.]+?)(?:\s+(?:tomorrow|today|at\s+\d+|on\s+[A-Za-z]+\s+\d+|for\s+\d+|with|next|\d{1,2}:)|$)/i
  );
  if (topicMatch && topicMatch[1] && topicMatch[1].trim().length > 2) {
    const raw = topicMatch[1].replace(/^(a|an|the)\s+/i, "").trim();
    if (raw.length > 2 && !/^(google meet|meeting|consultation)$/i.test(raw)) {
      topic = raw.charAt(0).toUpperCase() + raw.slice(1);
    }
  } else if (history && history.length > 0) {
    // If not specified in the current query, check previous user messages
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === "user") {
        const prevMatch = history[i].content.match(
          /(?:about|regarding|on|topic[:\s]+)(?:the\s+)?([^,.]+?)(?:\s+(?:tomorrow|today|at\s+\d+|on\s+[A-Za-z]+\s+\d+|for\s+\d+|with|next|\d{1,2}:)|$)/i
        );
        if (prevMatch && prevMatch[1] && prevMatch[1].trim().length > 2) {
          const raw = prevMatch[1].replace(/^(a|an|the)\s+/i, "").trim();
          if (raw.length > 2 && !/^(google meet|meeting|consultation)$/i.test(raw)) {
            topic = raw.charAt(0).toUpperCase() + raw.slice(1);
            break;
          }
        }
      }
    }
  }

  // Parse time (e.g., "3 PM", "3:00 PM", "11:55 PM", "11.55 pm", "11:55 AM", "15:00")
  let hours: number | null = null;
  let minutes = 0;
  let hasTime = false;

  const timeRegex =
    /(?:at\s+)?(\d{1,2})(?::(\d{2})|\.(\d{2}))?\s*(am|pm)\b|\bat\s+(\d{1,2})(?::(\d{2})|\.(\d{2}))?\b/i;
  const tM = query.match(timeRegex);
  if (tM) {
    let rawH = parseInt(tM[1] || tM[5], 10);
    const rawM = parseInt(tM[2] || tM[3] || tM[6] || tM[7] || "0", 10);
    const ampm = (tM[4] || "").toLowerCase();

    if (ampm === "pm" && rawH < 12) rawH += 12;
    if (ampm === "am" && rawH === 12) rawH = 0;

    if (rawH >= 0 && rawH < 24 && rawM >= 0 && rawM < 60) {
      hours = rawH;
      minutes = rawM;
      hasTime = true;
    }
  }

  // Parse date
  let hasDate = false;
  const now = new Date();
  const tzFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [yStr, moStr, dStr] = tzFormatter.format(now).split("-");
  let targetDate = new Date(Number(yStr), Number(moStr) - 1, Number(dStr));

  if (/\btomorrow\b/i.test(query)) {
    targetDate.setDate(targetDate.getDate() + 1);
    hasDate = true;
  } else if (/\bday after tomorrow\b/i.test(query)) {
    targetDate.setDate(targetDate.getDate() + 2);
    hasDate = true;
  } else if (/\btoday\b/i.test(query)) {
    hasDate = true;
  } else {
    // Specific dates: e.g., "8 October", "October 8", "Oct 8th 2026"
    const mMatch =
      query.match(
        /\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+(\d{4}))?\b/i
      ) ||
      query.match(
        /\b(?:on\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?\b/i
      );

    if (mMatch) {
      const monthNames = [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ];
      let dVal: number;
      let mVal: string;
      let yVal = parseInt(yStr, 10);

      if (isNaN(parseInt(mMatch[1], 10))) {
        mVal = mMatch[1].toLowerCase().slice(0, 3);
        dVal = parseInt(mMatch[2], 10);
        if (mMatch[3]) yVal = parseInt(mMatch[3], 10);
      } else {
        dVal = parseInt(mMatch[1], 10);
        mVal = mMatch[2].toLowerCase().slice(0, 3);
        if (mMatch[3]) yVal = parseInt(mMatch[3], 10);
      }

      const moIndex = monthNames.indexOf(mVal);
      if (moIndex >= 0 && dVal >= 1 && dVal <= 31) {
        targetDate = new Date(yVal, moIndex, dVal);
        hasDate = true;
      }
    }
  }

  let startIso: string | undefined = undefined;
  if (hasDate || hasTime) {
    const finalH = hours !== null ? hours : 15; // default 3:00 PM if date specified without time
    const finalM = minutes;
    const yF = targetDate.getFullYear();
    const moF = String(targetDate.getMonth() + 1).padStart(2, "0");
    const dF = String(targetDate.getDate()).padStart(2, "0");
    const hF = String(finalH).padStart(2, "0");
    const mF = String(finalM).padStart(2, "0");
    startIso = `${yF}-${moF}-${dF}T${hF}:${mF}:00`;
  }

  return {
    isMeetingQuery: true,
    isUpdate,
    hasDate,
    hasTime,
    startIso,
    topic,
    durationMinutes,
    extraAttendees,
  };
}

/**
 * Handles meeting scheduling and updating directly with Google Calendar and Email dispatch,
 * formatting an authoritative response with active Google Meet and Google Calendar URLs.
 */
export async function executeMeetingAction(params: {
  query: string;
  clientName: string;
  clientEmail: string | null;
  timeZone?: string;
  history?: Array<{ role: string; content: string }>;
}): Promise<string | null> {
  const tz = params.timeZone || process.env.TIMEZONE || "Asia/Kolkata";
  const intent = parseMeetingIntent(params.query, tz, params.history);

  if (!intent.isMeetingQuery) {
    return null;
  }

  const auditor = getAuditorProfile();
  const allAttendees = sanitizeEmailList([
    params.clientEmail,
    auditor.email,
    ...intent.extraAttendees,
  ]);

  // Case 1: Meeting Update or Attendee Add
  if (intent.isUpdate) {
    try {
      const calResult = await updateGoogleCalendarEvent({
        topic: intent.topic,
        start: intent.startIso,
        durationMinutes: intent.durationMinutes,
        addAttendees: intent.extraAttendees,
        timeZone: tz,
        auditorName: auditor.name,
        auditorFirm: auditor.firm,
        auditorEmail: auditor.email,
      });

      const updatedAttendees = calResult.attendees || allAttendees;

      // Send email notifications
      if (updatedAttendees.length > 0) {
        await sendMeetingInviteEmail({
          topic: intent.topic,
          start: intent.startIso || new Date().toISOString().slice(0, 19),
          durationMinutes: intent.durationMinutes,
          meetLink: calResult.meetLink,
          attendees: updatedAttendees,
          timeZone: tz,
          auditorName: auditor.name,
          auditorFirm: auditor.firm,
          auditorEmail: auditor.email,
          auditorPhone: auditor.phone,
        }).catch((e) => console.warn("Email invite dispatch note:", e?.message));
      }

      return `📅 **Meeting Status: Confirmed & Synchronized in Google Calendar**
📅 **Updated Consultation:** ${intent.topic}
Google Calendar has been updated directly for all participants, and official Google Calendar invitation updates have been dispatched.

👥 **Participants:** ${updatedAttendees.join(", ")}

📹 [Join Google Meet](${calResult.meetLink})

📆 [View in Google Calendar](${calResult.htmlLink || calResult.calendarWebUrl})`;
    } catch (err: any) {
      console.error("Meeting update error:", err);
      return `Could not update the meeting: ${err?.message || "Unknown error"}`;
    }
  }

  // Case 2: Schedule requested, but NO date or time specified
  if (!intent.hasDate && !intent.hasTime) {
    return `📅 I am happy to schedule the Google Meet. Please provide me the date, time, and topic.`;
  }

  // Case 3: Schedule with provided date and time
  const startIso = intent.startIso || new Date().toISOString().slice(0, 19);

  try {
    const calResult = await scheduleGoogleCalendarEvent({
      topic: intent.topic,
      start: startIso,
      durationMinutes: intent.durationMinutes,
      attendees: allAttendees,
      timeZone: tz,
      auditorName: auditor.name,
      auditorFirm: auditor.firm,
      auditorEmail: auditor.email,
    });

    // Send email invitation
    await sendMeetingInviteEmail({
      topic: intent.topic,
      start: startIso,
      durationMinutes: intent.durationMinutes,
      meetLink: calResult.meetLink,
      attendees: allAttendees,
      timeZone: tz,
      auditorName: auditor.name,
      auditorFirm: auditor.firm,
      auditorEmail: auditor.email,
      auditorPhone: auditor.phone,
    }).catch((e) => console.warn("Email invite dispatch note:", e?.message));

    const formattedTime = formatMeetingTime(startIso, tz);

    return `📅 **Meeting Status: Confirmed & Synchronized in Google Calendar**
📅 **Scheduled Date & Time:** ${formattedTime} (${tz})
**Topic:** ${intent.topic} (Duration: ${intent.durationMinutes} minutes)

Google Calendar has been updated directly for all participants, and official Google Calendar invitation updates have been dispatched.

👥 **Participants:** ${allAttendees.join(", ")}

📹 [Join Google Meet](${calResult.meetLink})

📆 [View in Google Calendar](${calResult.htmlLink || calResult.calendarWebUrl})`;
  } catch (err: any) {
    console.error("Meeting schedule error:", err);
    return `Could not schedule the meeting in Google Calendar: ${err?.message || "Unknown error"}`;
  }
}
