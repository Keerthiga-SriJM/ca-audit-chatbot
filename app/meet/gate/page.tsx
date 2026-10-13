"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function GateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawUrl = searchParams.get("url") || "";
  const meetUrl = rawUrl.includes("ca-audit-consultation")
    ? "https://meet.google.com/new"
    : rawUrl;
  const startParam = searchParams.get("start") || "";
  const durationParam = parseInt(searchParams.get("duration") || "30", 10);
  const topic = searchParams.get("topic") || "CA Statutory Audit Consultation";

  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startDate = startParam ? new Date(startParam) : null;
  const startTime = startDate && !isNaN(startDate.getTime()) ? startDate.getTime() : null;
  const durationMs = (durationParam > 0 ? durationParam : 30) * 60 * 1000;
  const endTime = startTime ? startTime + durationMs : null;

  const isMeetingOver = endTime !== null && now.getTime() >= endTime;
  const diffStartMs = startTime ? startTime - now.getTime() : null;
  const isFutureMeeting = !isMeetingOver && diffStartMs !== null && diffStartMs > 5 * 60 * 1000;
  const isMeetingLive = !isMeetingOver && !isFutureMeeting;

  // Countdown calculations
  const remaining = Math.max(0, diffStartMs ?? 0);
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((remaining / (1000 * 60)) % 60);
  const seconds = Math.floor((remaining / 1000) % 60);

  const minutesSinceEnd = endTime ? Math.max(0, Math.floor((now.getTime() - endTime) / (60 * 1000))) : 0;

  // Auto redirect ONLY when meeting is live
  useEffect(() => {
    if (isMeetingLive && meetUrl && /^https?:\/\//.test(meetUrl)) {
      const timeout = setTimeout(() => {
        window.location.href = meetUrl;
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [isMeetingLive, meetUrl]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#f8fafc",
    }}>
      <div style={{
        maxWidth: "520px",
        width: "100%",
        background: "#ffffff",
        color: "#0f172a",
        borderRadius: "16px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        overflow: "hidden",
      }}>
        {/* TOP STATUS BANNER */}
        <div style={{
          background: isMeetingOver ? "#7f1d1d" : isFutureMeeting ? "#78350f" : "#166534",
          color: "#ffffff",
          padding: "20px 24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>
            {isMeetingOver ? "🛑" : isFutureMeeting ? "⏳" : "🟢"}
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
            {isMeetingOver
              ? "Scheduled Meeting Over"
              : isFutureMeeting
              ? "Meeting Waiting Room"
              : "Joining Consultation..."}
          </h1>
          <p style={{ fontSize: "13px", opacity: 0.9, margin: "6px 0 0 0" }}>
            {isMeetingOver
              ? "The consultation window has ended"
              : isFutureMeeting
              ? "Participants must stay outside until scheduled time"
              : "Active consultation in progress"}
          </p>
        </div>

        {/* BODY */}
        <div style={{ padding: "24px" }}>
          {isMeetingOver && (
            <div>
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "20px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "#991b1b", letterSpacing: "0.05em" }}>
                  Consultation Closed
                </div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#7f1d1d", marginTop: "4px" }}>
                  Ended {minutesSinceEnd > 0 ? `${minutesSinceEnd} minute${minutesSinceEnd === 1 ? "" : "s"} ago` : "just now"}
                </div>
                <div style={{ fontSize: "13px", color: "#991b1b", marginTop: "6px", lineHeight: "1.4" }}>
                  This meeting room is locked. Access to Google Meet is closed once the scheduled consultation time has elapsed.
                </div>
              </div>
            </div>
          )}

          {isFutureMeeting && (
            <div>
              <div style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "20px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", color: "#92400e", letterSpacing: "0.05em" }}>
                  Time Remaining To Start
                </div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  marginTop: "10px",
                }}>
                  <div style={{ textAlign: "center", minWidth: "48px" }}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#92400e" }}>{days}</div>
                    <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#b45309", fontWeight: 600 }}>Days</div>
                  </div>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "#d97706" }}>:</span>
                  <div style={{ textAlign: "center", minWidth: "48px" }}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#92400e" }}>{hours.toString().padStart(2, "0")}</div>
                    <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#b45309", fontWeight: 600 }}>Hours</div>
                  </div>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "#d97706" }}>:</span>
                  <div style={{ textAlign: "center", minWidth: "48px" }}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#92400e" }}>{minutes.toString().padStart(2, "0")}</div>
                    <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#b45309", fontWeight: 600 }}>Mins</div>
                  </div>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "#d97706" }}>:</span>
                  <div style={{ textAlign: "center", minWidth: "48px" }}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#92400e" }}>{seconds.toString().padStart(2, "0")}</div>
                    <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#b45309", fontWeight: 600 }}>Secs</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isMeetingLive && (
            <div style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "20px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#166534" }}>
                Session is Active
              </div>
              <div style={{ fontSize: "13px", color: "#15803d", marginTop: "4px" }}>
                Redirecting you to Google Meet now...
              </div>
              {meetUrl && (
                <a
                  href={meetUrl}
                  style={{
                    display: "inline-block",
                    marginTop: "12px",
                    background: "#16a34a",
                    color: "#ffffff",
                    padding: "9px 18px",
                    borderRadius: "6px",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Click Here If Not Redirected
                </a>
              )}
            </div>
          )}

          {/* MEETING METADATA CARD */}
          <div style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "14px 16px",
            fontSize: "13px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b", fontWeight: 600 }}>Topic:</span>
              <span style={{ color: "#0f172a", fontWeight: 700 }}>{topic}</span>
            </div>
            {startDate && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>Scheduled Slot:</span>
                <span style={{ color: "#0f172a", fontWeight: 600 }}>
                  {startDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  {endTime ? ` – ${new Date(endTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}` : ""}
                  {" "}({durationParam} Mins)
                </span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b", fontWeight: 600 }}>Auditor:</span>
              <span style={{ color: "#166534", fontWeight: 600 }}>CA Keerthiga Sri J.M.</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b", fontWeight: 600 }}>Meeting Status:</span>
              <span style={{
                color: isMeetingOver ? "#b91c1c" : isFutureMeeting ? "#b45309" : "#16a34a",
                fontWeight: 700,
              }}>
                {isMeetingOver ? "🔴 Over / Closed" : isFutureMeeting ? "⏳ Waiting Room" : "🟢 Ready / Active"}
              </span>
            </div>
          </div>

          <div style={{ marginTop: "20px", display: "flex", justifyContent: "center" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 20px",
                background: "#0f172a",
                color: "#ffffff",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "13.5px",
                textDecoration: "none",
              }}
            >
              ← Return to Audit Desk
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MeetingGatePage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading meeting status...</div>}>
      <GateContent />
    </Suspense>
  );
}
