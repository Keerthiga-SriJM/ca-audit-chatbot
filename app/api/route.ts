import { NextResponse } from "next/server";
import { apiResponse, handleCorsPreflight } from "@/lib/cors";
import { isLocalModel, OLLAMA_CHAT_MODEL, CHAT_MODEL, OLLAMA_BASE_URL } from "@/lib/gemini";
import { getAuditorProfile } from "@/lib/langchain";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const auditor = getAuditorProfile();

  let dbStatus = "unknown";
  let clientCount = 0;
  try {
    const { count, error } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true });
    if (!error) {
      dbStatus = "connected";
      clientCount = count ?? 0;
    } else {
      dbStatus = `error: ${error.message}`;
    }
  } catch (err: any) {
    dbStatus = `offline: ${err?.message}`;
  }

  return apiResponse({
    name: "CA Audit Desk & Intelligence API",
    version: "1.0.0",
    description:
      "Enterprise REST API for 10-Year Audit Document Ingestion, Financial RAG Analysis, Automated Google Meet Scheduling, and Multi-Participant Dispatch.",
    status: "healthy",
    timestamp: new Date().toISOString(),
    documentation: `${baseUrl}/docs`,
    openApiSpec: `${baseUrl}/api/openapi.json`,
    postmanCollection: `${baseUrl}/api/postman.json`,
    environment: {
      provider: isLocalModel() ? "local-ollama" : "cloud-gemini",
      chatModel: isLocalModel() ? OLLAMA_CHAT_MODEL : CHAT_MODEL,
      ollamaEndpoint: isLocalModel() ? OLLAMA_BASE_URL : null,
      timezone: process.env.TIMEZONE || "Asia/Kolkata",
      database: dbStatus,
      registeredClients: clientCount,
    },
    auditor: {
      name: auditor.name,
      firm: auditor.firm,
      regNo: auditor.regNo,
      designation: auditor.designation,
      email: auditor.email,
    },
    endpoints: {
      chat: {
        method: "POST",
        path: "/api/chat",
        description: "Ask financial audit questions (RAG) and trigger Google Meet bookings",
      },
      ingest: {
        method: "POST",
        path: "/api/ingest",
        description: "Upload audit documents (PDF, Excel, CSV, TXT) or raw text/JSON to embed and index",
      },
      clients: {
        list: { method: "GET", path: "/api/clients", description: "List all audit clients" },
        create: { method: "POST", path: "/api/clients", description: "Register a new client" },
        get: { method: "GET", path: "/api/clients/:id", description: "Get client profile & stats" },
        delete: { method: "DELETE", path: "/api/clients/:id", description: "Delete a client and all records" },
      },
      financials: {
        get: { method: "GET", path: "/api/financials?clientId={id}", description: "Fetch 10-year financial records" },
        upsert: { method: "POST", path: "/api/financials", description: "Add or update financial year entries" },
      },
      calendar: {
        sync: { method: "POST", path: "/api/calendar/sync", description: "Schedule or update Google Meet consultation" },
        query: { method: "GET", path: "/api/calendar/sync?q={query}", description: "Search upcoming meetings" },
      },
      email: {
        send: { method: "POST", path: "/api/email/send", description: "Send calendar invite email with .ics attachment" },
      },
      voice: {
        transcribe: { method: "POST", path: "/api/voice/transcribe", description: "Transcribe audio to text" },
      },
    },
  });
}
