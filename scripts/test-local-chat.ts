import * as fs from "node:fs";
import * as path from "node:path";

// 1. Load environment variables first
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

async function main() {
  const { embedQuery } = await import("../lib/gemini");
  const { runLangChainAuditChat } = await import("../lib/langchain");
  const { supabase } = await import("../lib/supabase");

  console.log("1. Testing Local 768-dim Query Embedding via Ollama (nomic-embed-text)...");
  const q = "What was the net profit of Apex Enterprises in FY 2022?";
  const vec = await embedQuery(q);
  console.log("Vector dimensions:", vec.length);

  console.log("2. Testing RAG matching from Supabase chunks...");
  const clientId = "5f3725aa-4c39-4de4-af19-22ebc2cd227b"; // Apex Enterprises
  const { data: chunks } = await supabase.rpc("match_chunks", {
    q: vec as unknown as string,
    cid: clientId,
    k: 4,
  });
  const excerpts = ((chunks as any[]) ?? []).map((c) => c.content);
  console.log("Retrieved chunks:", excerpts.length);

  console.log("3. Testing Local Llama 3.1 LangChain Answer Generation...");
  const reply = await runLangChainAuditChat({
    messages: [{ role: "user", content: q }],
    clientName: "Apex Enterprises Pvt Ltd",
    clientEmail: "finance@apexenterprises.com",
    financials: [{ year: 2022, income: 960, profit: 110.8, loss: 0 }],
    excerpts,
    mcpClient: null,
  });

  console.log("\n================ LOCAL MODEL RESPONSE ================\n");
  console.log(reply);
  console.log("\n======================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
