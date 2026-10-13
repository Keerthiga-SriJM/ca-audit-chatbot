import { apiResponse, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "CA Audit Desk & Intelligence API",
      version: "1.0.0",
      description:
        "Enterprise-grade REST API for Chartered Accountant 10-Year Audit RAG intelligence, client financial analysis, automated Google Meet scheduling, and multi-party consultation dispatch.",
      contact: {
        name: "CA Audit Desk Support",
        email: process.env.AUDITOR_EMAIL || "keerthigasri04@gmail.com",
      },
    },
    servers: [
      {
        url: baseUrl,
        description: "Current Host Server",
      },
      {
        url: "http://localhost:3000",
        description: "Local Development Server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "API Key authentication (configured via API_KEY environment variable)",
        },
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT or API_KEY",
          description: "Bearer token authentication (configured via API_KEY or APP_PASSWORD)",
        },
      },
      schemas: {
        Client: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Apex Enterprises" },
            email: { type: "string", format: "email", nullable: true, example: "client@apex.com" },
          },
          required: ["id", "name"],
        },
        FinancialRow: {
          type: "object",
          properties: {
            year: { type: "integer", example: 2024 },
            income: { type: "number", nullable: true, example: 4500000 },
            profit: { type: "number", nullable: true, example: 850000 },
            loss: { type: "number", nullable: true, example: 0 },
          },
          required: ["year"],
        },
        ChatRequest: {
          type: "object",
          properties: {
            message: { type: "string", example: "What was the total profit in 2023?" },
            query: { type: "string", example: "Schedule a Google Meet tomorrow at 3 PM with palanitce@gmail.com" },
            messages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string", enum: ["user", "assistant"] },
                  content: { type: "string" },
                },
                required: ["role", "content"],
              },
            },
            clientId: { type: "string", format: "uuid", description: "Target client ID" },
            clientName: { type: "string", example: "Apex Enterprises", description: "Alternative to clientId" },
          },
        },
        ChatResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            reply: { type: "string" },
            isMeetingAction: { type: "boolean" },
            client: { $ref: "#/components/schemas/Client" },
            citations: { type: "array", items: { type: "string" } },
            financials: { type: "array", items: { $ref: "#/components/schemas/FinancialRow" } },
          },
        },
        CalendarSyncRequest: {
          type: "object",
          properties: {
            topic: { type: "string", example: "10-Year Audit Consultation" },
            start: { type: "string", example: "2026-10-09T15:00:00", description: "YYYY-MM-DDTHH:mm:ss" },
            durationMinutes: { type: "integer", default: 30, example: 30 },
            attendees: { type: "array", items: { type: "string", format: "email" }, example: ["client@apex.com", "palanitce@gmail.com"] },
            action: { type: "string", enum: ["create", "update"], default: "create" },
            eventId: { type: "string", description: "Optional Google Calendar event ID to update" },
          },
          required: ["topic", "start"],
        },
      },
    },
    paths: {
      "/api": {
        get: {
          summary: "API Service Discovery & Metadata",
          description: "Returns API status, registered client counts, configured model provider, auditor profile, and endpoint directory.",
          responses: {
            "200": {
              description: "API status and discovery directory",
            },
          },
        },
      },
      "/api/health": {
        get: {
          summary: "Health & Uptime Check",
          description: "Returns system latency, database health, and process uptime.",
          responses: {
            "200": {
              description: "Service is healthy",
            },
          },
        },
      },
      "/api/chat": {
        post: {
          summary: "Audit Chat & Meeting Assistant",
          description: "Submits a query to the LangChain RAG pipeline with 10-year financial records, or triggers Google Meet scheduling/updating via Google Calendar API.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChatRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Successful response from Audit Assistant",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ChatResponse" },
                },
              },
            },
            "400": { description: "Invalid parameters or missing query" },
            "404": { description: "Client not found in audit registry" },
          },
        },
      },
      "/api/clients": {
        get: {
          summary: "List Audit Clients",
          description: "Retrieves all registered audit clients with optional financial audit status.",
          parameters: [
            {
              name: "stats",
              in: "query",
              schema: { type: "boolean" },
              description: "Include financial year count and document chunk status",
            },
          ],
          responses: {
            "200": { description: "List of registered clients" },
          },
        },
        post: {
          summary: "Register a New Client",
          description: "Creates an audit client profile in the database.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", example: "Apex Enterprises" },
                    email: { type: "string", format: "email", example: "finance@apex.com" },
                  },
                  required: ["name"],
                },
              },
            },
          },
          responses: {
            "201": { description: "Client created successfully" },
            "200": { description: "Client already existed" },
          },
        },
      },
      "/api/clients/{id}": {
        get: {
          summary: "Get Client Details",
          description: "Fetches single client profile along with 10-year financials and chunk index stats.",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            "200": { description: "Client details" },
            "404": { description: "Client not found" },
          },
        },
        patch: {
          summary: "Update Client Profile",
          description: "Updates client name and/or email.",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Updated client" },
          },
        },
        delete: {
          summary: "Delete Client and Audit Records",
          description: "Permanently removes client and deletes all associated 10-year financials and vector chunks.",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            "200": { description: "Client deleted" },
          },
        },
      },
      "/api/financials": {
        get: {
          summary: "Get 10-Year Financial Ledger",
          description: "Fetches verified yearly income, profit, and loss figures, plus aggregated metrics.",
          parameters: [
            { name: "clientId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "clientName", in: "query", schema: { type: "string" } },
            { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
          ],
          responses: {
            "200": { description: "10-year ledger with aggregations" },
          },
        },
        post: {
          summary: "Upsert Financial Records",
          description: "Programmatically adds or updates yearly financial numbers for a client.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    clientId: { type: "string" },
                    clientName: { type: "string" },
                    records: {
                      type: "array",
                      items: { $ref: "#/components/schemas/FinancialRow" },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Records saved" },
          },
        },
      },
      "/api/ingest": {
        post: {
          summary: "Ingest & Index Audit Documents",
          description: "Uploads and parses a financial document (PDF, Excel, CSV, TXT) or raw JSON rows, generates 768-dim embeddings, and stores in Supabase pgvector.",
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    file: { type: "string", format: "binary" },
                    clientId: { type: "string" },
                    clientName: { type: "string" },
                  },
                  required: ["file"],
                },
              },
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    clientId: { type: "string" },
                    clientName: { type: "string" },
                    text: { type: "string", description: "CSV or document text" },
                    fileName: { type: "string" },
                    rows: { type: "array", items: { $ref: "#/components/schemas/FinancialRow" } },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Document successfully processed and indexed" },
          },
        },
      },
      "/api/calendar/sync": {
        get: {
          summary: "Query Calendar Consultations",
          description: "Finds latest scheduled audit consultation in Google Calendar.",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" }, description: "Search query" },
          ],
          responses: {
            "200": { description: "Event details" },
          },
        },
        post: {
          summary: "Schedule or Reschedule Google Meet",
          description: "Creates or updates Google Meet consultation directly in Google Calendar and returns Meet and Calendar URLs.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CalendarSyncRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Meeting event scheduled and synchronized" },
          },
        },
      },
      "/api/email/send": {
        post: {
          summary: "Send Meeting Invite Email",
          description: "Sends an email with RFC 5545 iCalendar invite to all participants.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    topic: { type: "string", example: "FY 2024 Audit Review" },
                    start: { type: "string", example: "2026-10-09T15:00:00" },
                    durationMinutes: { type: "integer", default: 30 },
                    meetLink: { type: "string", example: "https://meet.google.com/new" },
                    attendees: { type: "array", items: { type: "string", format: "email" } },
                  },
                  required: ["topic", "start", "meetLink", "attendees"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Email dispatched" },
          },
        },
      },
      "/api/voice/transcribe": {
        post: {
          summary: "Transcribe Speech Audio",
          description: "Transcribes user speech into audit query text using Gemini audio capabilities.",
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    file: { type: "string", format: "binary" },
                  },
                },
              },
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    audioBase64: { type: "string" },
                    mimeType: { type: "string", default: "audio/webm" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Transcription result" },
          },
        },
      },
    },
  };

  return apiResponse(spec);
}
