import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { Embeddings } from "@langchain/core/embeddings";
import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import type { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import {
  embedMany,
  embedQuery,
  isLocalModel,
  OLLAMA_BASE_URL,
  OLLAMA_CHAT_MODEL,
  OLLAMA_EMBED_MODEL,
  EMBED_MODEL,
  EMBED_DIMS,
} from "./gemini";

export { EMBED_MODEL, EMBED_DIMS };

/**
 * Custom LangChain Embeddings class that guarantees 768-dimension vectors
 * for Supabase pgvector schema (vector(768)), routing to local Ollama (nomic-embed-text)
 * or Gemini based on configuration.
 */
export class Gemini768Embeddings extends Embeddings {
  modelName: string;

  constructor(fields?: { modelName?: string; maxConcurrency?: number; maxRetries?: number }) {
    const { modelName, ...rest } = fields ?? {};
    super(rest);
    this.modelName = modelName || (isLocalModel() ? OLLAMA_EMBED_MODEL : EMBED_MODEL);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return embedMany(documents);
  }

  async embedQuery(document: string): Promise<number[]> {
    return embedQuery(document);
  }
}

export function getAuditorProfile() {
  return {
    name: process.env.AUDITOR_NAME || "CA Keerthiga Sri J.M.",
    firm: process.env.AUDITOR_FIRM || "J.M. & Associates Chartered Accountants",
    regNo: process.env.AUDITOR_REG_NO || "FCA-084920",
    designation: process.env.AUDITOR_DESIGNATION || "Senior Statutory Auditor & Tax Consultant",
    email: process.env.AUDITOR_EMAIL || "keerthigasri04@gmail.com",
    phone: process.env.AUDITOR_PHONE || "+91 98765 43210",
    officeAddress: process.env.AUDITOR_OFFICE_ADDRESS || "Chennai, Tamil Nadu, India",
    specialization:
      process.env.AUDITOR_SPECIALIZATION ||
      "Statutory Audit, Tax Compliance, 10-Year Financial Due Diligence",
  };
}

export function buildLangChainSystemMessage(params: {
  clientName: string;
  clientEmail: string | null;
  financials: Array<{ year: number; income: number | null; profit: number | null; loss: number | null }>;
  excerpts: string[];
  attendees: string[];
  hasMeetingTools?: boolean;
}): SystemMessage {
  const auditor = getAuditorProfile();
  const tz = process.env.TIMEZONE || "Asia/Kolkata";
  const now = new Date().toLocaleString("en-GB", {
    timeZone: tz,
    dateStyle: "full",
    timeStyle: "short",
  });

  const compactLedger = params.financials.length > 0
    ? params.financials.map((f) => `FY ${f.year}: Income=${f.income ?? 0}, Profit=${f.profit ?? 0}, Loss=${f.loss ?? 0}`).join("\n")
    : "No records.";

  const compactExcerpts = params.excerpts.slice(0, 3).join("\n---\n");

  let content = `You are an expert AI Chartered Accountant (CA) Audit Assistant powered by LangChain.
You work on behalf of the Lead Auditor and Accounting Firm:
- Lead Auditor: ${auditor.name} (${auditor.regNo})
- Accounting Firm: ${auditor.firm}
- Designation: ${auditor.designation}
- Auditor Email: ${auditor.email}

Current Client under Audit Review:
- Client Name: "${params.clientName}"
- Current Date & Time: ${now} (${tz})

==================================================
AUDIT RECORD CONTEXT (10-YEAR CLIENT FINANCIALS & DOCUMENT)
==================================================

10-YEAR FINANCIAL LEDGER:
${compactLedger}

RETRIEVED AUDIT DOCUMENT EXCERPTS:
${compactExcerpts || "No extra document excerpts."}

==================================================
CRITICAL OPERATING RULES & DIRECTIVES
==================================================
1. STRICT SINGLE OUTPUT RULE:
   - For every question asked regarding the client's financials or audit document, provide strictly ONLY ONE direct, appropriate, and accurate answer.
   - Do NOT offer multiple choices, alternative scenarios, bulleted possibilities, or speculative options.
   - Give one clear, authoritative, and concise answer.

2. NUMERICAL ACCURACY:
   - Quote numbers and currency units exactly as recorded in the 10-year financial ledger and document. Never invent or hallucinate figures.
   - If a calculation is requested (such as 10-year total income, average annual profit, loss comparison, or highest/lowest year), calculate the arithmetic precisely and return only that single computed answer.

3. UNFOUND DATA:
   - If the requested information is not in the audit records or context, state that plainly in one direct sentence.

4. COMMUNICATING CHATBOT & CONVERSATIONAL FLOW:
   - Reply to EACH and EVERY message or question the user asks.
   - Maintain a courteous, professional tone suitable for a Chartered Accountant firm.
   - If the user greets you or asks who you or the auditor are, reply warmly with the Auditor's and Client's details.`;

  if (params.hasMeetingTools) {
    content += `

5. GOOGLE MEET SCHEDULING & GOOGLE CALENDAR MANAGEMENT (MCP TOOLS):
   - A. SCHEDULING NEW MEETINGS:
     * When the user asks to schedule a Google Meet, conference, or consultation, call the "schedule_meeting" tool.
     * Parse the exact date and time requested by the user. If the date or time is missing, ask for the date and time in one short question before scheduling.
       * CRITICAL 12-HR TO 24-HR MILITARY TIME CONVERSION:
         - If PM: convert to 24-hour time! (e.g. 11:55 PM / 11.55 pm MUST be 23:55:00, NEVER 11:55:00!)
         - 1:00 PM -> 13:00:00, 2:00 PM -> 14:00:00, 11:00 PM -> 23:00:00, 12:00 PM -> 12:00:00.
         - 11:55 AM -> 11:55:00, 12:00 AM (midnight) -> 00:00:00.
         - ALWAYS pass start in full 24-hour YYYY-MM-DDTHH:mm:ss format (e.g. 2026-10-06T15:00:00)!
     * If any participant email addresses are mentioned (e.g. palanitce@gmail.com, or any @ email), you MUST extract them and pass them in "extraAttendees" so they receive the meeting invitation and calendar event!

   - B. UPDATING MEETINGS & UPDATING GOOGLE CALENDAR FOR ALL PARTICIPANTS:
     * If the user asks to:
       - Update the Google Calendar meeting
       - Add participants/attendees to the meeting
       - Update Google Calendar for all participants (e.g. "it want to update in google calender for all the participents in the google meeting")
       - Reschedule or change meeting time or topic
       --> You MUST IMMEDIATELY call the "update_meeting" tool!
     * NEVER ask the user for an Event ID! The tool automatically finds and updates the active/scheduled consultation in Google Calendar.
     * Extract any mentioned participant email addresses and pass them in "addAttendees". If no specific emails are mentioned, call "update_meeting" directly so it syncs all current participants in Google Calendar.

   - C. RESPONSE FORMAT AFTER TOOL EXECUTION:
     1. Prominently state: "📅 Meeting Status: Confirmed & Synchronized in Google Calendar"
     2. Prominently display: "📅 Scheduled Date & Time: [Date] at [Time] [Timezone]"
     3. Confirm clearly: "Google Calendar has been updated directly for all participants, and official Google Calendar invitation updates have been dispatched."
     4. List all invited participants: "👥 Participants: [email1, email2, ...]"
     5. Provide the clickable Google Meet link: [Join Google Meet](<meetLink>)
     6. Provide the Google Calendar link: [View in Google Calendar](<calendarHtmlLinkOrWebUrl>)`;
  }

  return new SystemMessage(content);
}

/**
 * Creates a LangChain DynamicStructuredTool that calls the MCP Google Meet server to schedule meetings.
 */
export function createMcpMeetTool(
  mcpClient: McpClient,
  attendees: string[]
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "schedule_meeting",
    description:
      "Schedule a new Google Meet on a specific topic and send email invitations to attendees. Call only when the user requests a new meeting and provides a date and time.",
    schema: z.object({
      topic: z.string().describe("The topic or agenda for the Google Meet"),
      start: z
        .string()
        .describe(
          "Local start time in YYYY-MM-DDTHH:mm:ss 24-hour format (no timezone offset). 11:55 PM is 23:55:00, 1:00 PM is 13:00:00, 11:55 AM is 11:55:00."
        ),
      durationMinutes: z
        .number()
        .int()
        .min(5)
        .max(480)
        .default(30)
        .describe("Duration of the Google Meet in minutes"),
      extraAttendees: z
        .array(z.string())
        .optional()
        .describe("Any additional participant email addresses mentioned by the user to invite and email (e.g. palanitce@gmail.com)"),
    }),
    func: async ({ topic, start, durationMinutes, extraAttendees }) => {
      const allAttendees = Array.from(
        new Set([...attendees, ...(extraAttendees || [])])
      ).filter((e) => e && e.includes("@"));

      try {
        const res = await mcpClient.callTool({
          name: "schedule_meeting",
          arguments: { topic, start, durationMinutes, attendees: allAttendees },
        });
        const content = (res.content as { text?: string }[])
          .map((c) => c.text ?? "")
          .join("\n");
        return content;
      } catch (err: any) {
        return JSON.stringify({
          error: true,
          message: err?.message || "Failed to schedule Google Meet via MCP",
        });
      }
    },
  });
}

/**
 * Creates a LangChain DynamicStructuredTool that calls the MCP server to update existing meetings in Google Calendar.
 */
export function createMcpUpdateMeetTool(
  mcpClient: McpClient,
  attendees: string[]
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "update_meeting",
    description:
      "Update an existing Google Meet / Calendar consultation for all participants. Call when the user requests to update the meeting in Google Calendar, add participants to the meeting, change the meeting date/time, or synchronize Google Calendar for all participants.",
    schema: z.object({
      eventId: z.string().optional().describe("Google Calendar event ID if known"),
      topic: z.string().optional().describe("Updated topic or agenda"),
      start: z
        .string()
        .optional()
        .describe(
          "Updated local start time in YYYY-MM-DDTHH:mm:ss 24-hour format (no timezone offset), or keep unchanged"
        ),
      durationMinutes: z
        .number()
        .int()
        .min(5)
        .max(480)
        .optional()
        .describe("Duration in minutes"),
      addAttendees: z
        .array(z.string())
        .optional()
        .describe("Participant email addresses to add or update in Google Calendar"),
      attendees: z
        .array(z.string())
        .optional()
        .describe("Full list of attendee emails"),
    }),
    func: async ({ eventId, topic, start, durationMinutes, addAttendees, attendees: explicitAttendees }) => {
      const mergedAdd = Array.from(
        new Set([...(addAttendees || []), ...(explicitAttendees || [])])
      ).filter((e) => e && e.includes("@"));

      try {
        const res = await mcpClient.callTool({
          name: "update_meeting",
          arguments: {
            eventId,
            topic,
            start,
            durationMinutes,
            attendees: explicitAttendees,
            addAttendees: mergedAdd,
          },
        });
        const content = (res.content as { text?: string }[])
          .map((c) => c.text ?? "")
          .join("\n");
        return content;
      } catch (err: any) {
        return JSON.stringify({
          error: true,
          message: err?.message || "Failed to update Google Meet via MCP",
        });
      }
    },
  });
}

/**
 * Runs the LangChain RAG pipeline with optional tool calling.
 */
export async function runLangChainAuditChat(params: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  clientName: string;
  clientEmail: string | null;
  financials: Array<{ year: number; income: number | null; profit: number | null; loss: number | null }>;
  excerpts: string[];
  mcpClient?: McpClient | null;
}): Promise<string> {
  const auditor = getAuditorProfile();
  const attendees = [params.clientEmail, auditor.email].filter(Boolean) as string[];

  // 1) Prepare LangChain model (Local Ollama or Gemini)
  const isLocal = isLocalModel();
  let chatModel: any;

  if (isLocal || !process.env.GEMINI_API_KEY) {
    chatModel = new ChatOllama({
      baseUrl: OLLAMA_BASE_URL,
      model: OLLAMA_CHAT_MODEL,
      temperature: 0,
      numCtx: 1536,
      keepAlive: "30m",
    });
  } else {
    chatModel = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_CHAT_MODEL || "gemini-3.1-flash-lite",
      temperature: 0,
    });
  }

  // 2) Bind MCP Google Meet Tools (schedule + update) if MCP client is provided
  let modelWithTools = chatModel;
  let meetTool: DynamicStructuredTool | null = null;
  let updateMeetTool: DynamicStructuredTool | null = null;
  if (params.mcpClient && !isLocal) {
    meetTool = createMcpMeetTool(params.mcpClient, attendees);
    updateMeetTool = createMcpUpdateMeetTool(params.mcpClient, attendees);
    modelWithTools = chatModel.bindTools([meetTool, updateMeetTool]);
  }

  // 3) Construct conversation history
  const systemMsg = buildLangChainSystemMessage({
    clientName: params.clientName,
    clientEmail: params.clientEmail,
    financials: params.financials,
    excerpts: params.excerpts,
    attendees,
    hasMeetingTools: Boolean(params.mcpClient),
  });

  const conversation: BaseMessage[] = [systemMsg];
  for (const m of params.messages.slice(-6)) {
    if (m.role === "assistant") {
      conversation.push(new AIMessage(m.content));
    } else {
      conversation.push(new HumanMessage(m.content));
    }
  }

  // 4) Execute LangChain generation with tool loop
  let response = await modelWithTools.invoke(conversation);
  conversation.push(response);

  // Handle up to 3 tool calls if needed
  let toolIterations = 0;
  let lastToolOutput = "";
  while (
    meetTool &&
    updateMeetTool &&
    response.tool_calls &&
    response.tool_calls.length > 0 &&
    toolIterations < 3
  ) {
    toolIterations++;
    for (const call of response.tool_calls) {
      let toolOutput = "";
      if (call.name === "schedule_meeting") {
        toolOutput = await meetTool.invoke(call.args as any);
      } else if (call.name === "update_meeting") {
        toolOutput = await updateMeetTool.invoke(call.args as any);
      } else {
        toolOutput = `Unknown tool: ${call.name}`;
      }
      lastToolOutput = toolOutput;

      conversation.push(
        new ToolMessage({
          tool_call_id: call.id || `call_${Date.now()}`,
          name: call.name,
          content: toolOutput,
        })
      );
    }


    try {
      // Call model again with tool results
      response = await modelWithTools.invoke(conversation);
      conversation.push(response);
    } catch (err: any) {
      console.warn("Follow-up model call error after tool execution:", err);
      break;
    }
  }

  let replyText =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
      ? response.content
          .map((c: any) => (typeof c === "string" ? c : c?.text || ""))
          .join("")
      : "";

  if (!replyText.trim() && lastToolOutput) {
    replyText = lastToolOutput;
  }

  return replyText.trim() || "I have reviewed the audit documents.";
}
