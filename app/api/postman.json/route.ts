import { apiResponse, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const postmanCollection = {
    info: {
      name: "CA Audit Chatbot & Intelligence API",
      _postman_id: "ca-audit-api-v1",
      description:
        "Full collection of API endpoints for CA Audit Chatbot: RAG Chat, Document Ingestion, 10-Year Financials, Google Meet Scheduling, Email Dispatch, and Voice Transcription.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      { key: "baseUrl", value: baseUrl, type: "string" },
      { key: "apiKey", value: "", type: "string" },
    ],
    item: [
      {
        name: "Discovery & Health",
        item: [
          {
            name: "API Service Discovery",
            request: {
              method: "GET",
              header: [{ key: "Accept", value: "application/json" }],
              url: { raw: "{{baseUrl}}/api", host: ["{{baseUrl}}"], path: ["api"] },
              description: "Returns API metadata, status, provider, and available endpoints.",
            },
          },
          {
            name: "Health Check",
            request: {
              method: "GET",
              header: [{ key: "Accept", value: "application/json" }],
              url: { raw: "{{baseUrl}}/api/health", host: ["{{baseUrl}}"], path: ["api", "health"] },
              description: "Returns system latency, database health, and process uptime.",
            },
          },
        ],
      },
      {
        name: "Clients",
        item: [
          {
            name: "List All Clients",
            request: {
              method: "GET",
              header: [
                { key: "Accept", value: "application/json" },
                { key: "X-API-Key", value: "{{apiKey}}" },
              ],
              url: {
                raw: "{{baseUrl}}/api/clients?stats=true",
                host: ["{{baseUrl}}"],
                path: ["api", "clients"],
                query: [{ key: "stats", value: "true" }],
              },
            },
          },
          {
            name: "Register New Client",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "X-API-Key", value: "{{apiKey}}" },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify(
                  { name: "Apex Enterprises", email: "finance@apex.com" },
                  null,
                  2
                ),
              },
              url: { raw: "{{baseUrl}}/api/clients", host: ["{{baseUrl}}"], path: ["api", "clients"] },
            },
          },
          {
            name: "Get Client by ID",
            request: {
              method: "GET",
              header: [
                { key: "Accept", value: "application/json" },
                { key: "X-API-Key", value: "{{apiKey}}" },
              ],
              url: {
                raw: "{{baseUrl}}/api/clients/:id",
                host: ["{{baseUrl}}"],
                path: ["api", "clients", ":id"],
                variable: [{ key: "id", value: "CLIENT_UUID_HERE" }],
              },
            },
          },
          {
            name: "Delete Client",
            request: {
              method: "DELETE",
              header: [{ key: "X-API-Key", value: "{{apiKey}}" }],
              url: {
                raw: "{{baseUrl}}/api/clients/:id",
                host: ["{{baseUrl}}"],
                path: ["api", "clients", ":id"],
                variable: [{ key: "id", value: "CLIENT_UUID_HERE" }],
              },
            },
          },
        ],
      },
      {
        name: "Audit Chat & RAG",
        item: [
          {
            name: "Ask Financial Question (RAG)",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "X-API-Key", value: "{{apiKey}}" },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify(
                  {
                    clientName: "Apex Enterprises",
                    message: "What was the profit in 2021 and how does it compare to 2022?",
                  },
                  null,
                  2
                ),
              },
              url: { raw: "{{baseUrl}}/api/chat", host: ["{{baseUrl}}"], path: ["api", "chat"] },
            },
          },
          {
            name: "Schedule Meeting via Chat Prompt",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "X-API-Key", value: "{{apiKey}}" },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify(
                  {
                    clientName: "Apex Enterprises",
                    message:
                      "Schedule a Google Meet about the FY 2024 audit tomorrow at 3 PM for 45 minutes with palanitce@gmail.com",
                  },
                  null,
                  2
                ),
              },
              url: { raw: "{{baseUrl}}/api/chat", host: ["{{baseUrl}}"], path: ["api", "chat"] },
            },
          },
        ],
      },
      {
        name: "Financials",
        item: [
          {
            name: "Get 10-Year Financials",
            request: {
              method: "GET",
              header: [{ key: "X-API-Key", value: "{{apiKey}}" }],
              url: {
                raw: "{{baseUrl}}/api/financials?clientName=Apex%20Enterprises&order=asc",
                host: ["{{baseUrl}}"],
                path: ["api", "financials"],
                query: [
                  { key: "clientName", value: "Apex Enterprises" },
                  { key: "order", value: "asc" },
                ],
              },
            },
          },
          {
            name: "Upsert Financial Records",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "X-API-Key", value: "{{apiKey}}" },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify(
                  {
                    clientName: "Apex Enterprises",
                    records: [
                      { year: 2024, income: 5500000, profit: 920000, loss: 0 },
                      { year: 2023, income: 4800000, profit: 780000, loss: 0 },
                    ],
                  },
                  null,
                  2
                ),
              },
              url: { raw: "{{baseUrl}}/api/financials", host: ["{{baseUrl}}"], path: ["api", "financials"] },
            },
          },
        ],
      },
      {
        name: "Document Ingestion",
        item: [
          {
            name: "Ingest Document (JSON / Text)",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "X-API-Key", value: "{{apiKey}}" },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify(
                  {
                    clientName: "Apex Enterprises",
                    fileName: "10yr_audit.csv",
                    text:
                      "Year,Income,Profit,Loss\n2015,1000000,150000,0\n2016,1200000,180000,0\n2017,1400000,210000,0\n2018,1700000,260000,0\n2019,2100000,320000,0\n2020,2500000,390000,0\n2021,3100000,490000,0\n2022,3800000,610000,0\n2023,4600000,750000,0\n2024,5500000,920000,0",
                  },
                  null,
                  2
                ),
              },
              url: { raw: "{{baseUrl}}/api/ingest", host: ["{{baseUrl}}"], path: ["api", "ingest"] },
            },
          },
        ],
      },
      {
        name: "Calendar & Meet",
        item: [
          {
            name: "Schedule Google Meet Consultation",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "X-API-Key", value: "{{apiKey}}" },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify(
                  {
                    topic: "Statutory Tax Due Diligence",
                    start: "2026-10-10T14:30:00",
                    durationMinutes: 45,
                    attendees: ["client@apex.com", "palanitce@gmail.com"],
                  },
                  null,
                  2
                ),
              },
              url: { raw: "{{baseUrl}}/api/calendar/sync", host: ["{{baseUrl}}"], path: ["api", "calendar", "sync"] },
            },
          },
          {
            name: "Query Latest Consultation",
            request: {
              method: "GET",
              header: [{ key: "X-API-Key", value: "{{apiKey}}" }],
              url: { raw: "{{baseUrl}}/api/calendar/sync", host: ["{{baseUrl}}"], path: ["api", "calendar", "sync"] },
            },
          },
        ],
      },
      {
        name: "Email & Voice",
        item: [
          {
            name: "Send Calendar Invite Email",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "X-API-Key", value: "{{apiKey}}" },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify(
                  {
                    topic: "CA Audit Final Review",
                    start: "2026-10-10T14:30:00",
                    durationMinutes: 45,
                    meetLink: "https://meet.google.com/new",
                    attendees: ["client@apex.com"],
                  },
                  null,
                  2
                ),
              },
              url: { raw: "{{baseUrl}}/api/email/send", host: ["{{baseUrl}}"], path: ["api", "email", "send"] },
            },
          },
        ],
      },
    ],
  };

  return apiResponse(postmanCollection);
}
