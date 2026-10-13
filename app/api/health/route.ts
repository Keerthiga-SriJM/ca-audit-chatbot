import { apiResponse, handleCorsPreflight } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { isLocalModel, OLLAMA_CHAT_MODEL, CHAT_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET() {
  const startTime = Date.now();
  let dbOk = false;
  let clientCount = 0;

  try {
    const { count, error } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true });
    if (!error) {
      dbOk = true;
      clientCount = count ?? 0;
    }
  } catch {
    dbOk = false;
  }

  const responseTimeMs = Date.now() - startTime;

  return apiResponse({
    status: dbOk ? "healthy" : "degraded",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    latencyMs: responseTimeMs,
    services: {
      database: dbOk ? "connected" : "unreachable",
      llmProvider: isLocalModel() ? "local-ollama" : "gemini",
      model: isLocalModel() ? OLLAMA_CHAT_MODEL : CHAT_MODEL,
    },
    metrics: {
      totalClients: clientCount,
    },
  });
}
