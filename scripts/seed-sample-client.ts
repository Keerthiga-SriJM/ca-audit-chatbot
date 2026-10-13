import { createClient } from "@supabase/supabase-js";
import { embedMany } from "../lib/gemini";
import { getAuditorProfile } from "../lib/langchain";
import * as fs from "node:fs";

// Load environment variables if not already loaded
for (const file of [".env", ".env.local"]) {
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

async function seed() {
  console.log("Seeding verified 10-year audit client: Apex Enterprises Pvt Ltd...");

  const auditor = getAuditorProfile();
  console.log(`Lead Auditor: ${auditor.name} (${auditor.firm})`);

  // 1) Find or create client
  let { data: client } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("name", "Apex Enterprises Pvt Ltd")
    .maybeSingle();

  if (!client) {
    const { data: newClient, error: cErr } = await supabase
      .from("clients")
      .insert({
        name: "Apex Enterprises Pvt Ltd",
        email: "finance@apexenterprises.com",
      })
      .select("id, name, email")
      .single();
    if (cErr) throw cErr;
    client = newClient;
  }

  const clientId = client!.id;
  console.log("Client ID:", clientId);

  // 2) 10-Year Financial Records (2015 to 2024)
  const rows = [
    { year: 2015, income: 450.0, profit: 45.5, loss: 0.0 },
    { year: 2016, income: 520.0, profit: 58.2, loss: 0.0 },
    { year: 2017, income: 610.0, profit: 72.4, loss: 0.0 },
    { year: 2018, income: 695.0, profit: 84.0, loss: 0.0 },
    { year: 2019, income: 780.0, profit: 95.5, loss: 0.0 },
    { year: 2020, income: 710.0, profit: 0.0, loss: 32.5 },
    { year: 2021, income: 830.0, profit: 65.0, loss: 0.0 },
    { year: 2022, income: 960.0, profit: 110.8, loss: 0.0 },
    { year: 2023, income: 1120.0, profit: 145.2, loss: 0.0 },
    { year: 2024, income: 1280.0, profit: 182.0, loss: 0.0 },
  ];

  // 3) Delete previous financials and chunks
  await supabase.from("chunks").delete().eq("client_id", clientId);
  await supabase.from("financials").delete().eq("client_id", clientId);

  // 4) Insert financials
  const { error: fErr } = await supabase.from("financials").insert(
    rows.map((r) => ({
      client_id: clientId,
      year: r.year,
      income: r.income,
      profit: r.profit,
      loss: r.loss,
    }))
  );
  if (fErr) throw fErr;

  // 5) Prepare high-quality semantic chunks for RAG
  const metadataChunk = `AUDIT REPORT VERIFICATION:
Lead Auditor: ${auditor.name} (${auditor.regNo})
Accounting Firm: ${auditor.firm}
Client: Apex Enterprises Pvt Ltd (finance@apexenterprises.com)
Audited Period: 2015 to 2024 (10 consecutive financial years).
Auditor Opinion: Clean / Unqualified with Emphasis of Matter in FY 2020 due to pandemic supply chain loss.`;

  const summaryChunk = `10-YEAR FINANCIAL SUMMARY FOR APEX ENTERPRISES PVT LTD:
FY 2015: Income = 450.00 Lakhs, Profit = 45.50 Lakhs, Loss = 0.00 Lakhs
FY 2016: Income = 520.00 Lakhs, Profit = 58.20 Lakhs, Loss = 0.00 Lakhs
FY 2017: Income = 610.00 Lakhs, Profit = 72.40 Lakhs, Loss = 0.00 Lakhs
FY 2018: Income = 695.00 Lakhs, Profit = 84.00 Lakhs, Loss = 0.00 Lakhs
FY 2019: Income = 780.00 Lakhs, Profit = 95.50 Lakhs, Loss = 0.00 Lakhs
FY 2020: Income = 710.00 Lakhs, Profit = 0.00 Lakhs, Loss = 32.50 Lakhs (Pandemic Loss)
FY 2021: Income = 830.00 Lakhs, Profit = 65.00 Lakhs, Loss = 0.00 Lakhs
FY 2022: Income = 960.00 Lakhs, Profit = 110.80 Lakhs, Loss = 0.00 Lakhs
FY 2023: Income = 1120.00 Lakhs, Profit = 145.20 Lakhs, Loss = 0.00 Lakhs
FY 2024: Income = 1280.00 Lakhs, Profit = 182.00 Lakhs, Loss = 0.00 Lakhs
Total 10-Year Income: 7,955.00 Lakhs. Total Net Profit: 858.60 Lakhs. Net Loss: 32.50 Lakhs in 2020.`;

  const yearChunks = rows.map(
    (r) =>
      `Client "Apex Enterprises Pvt Ltd" Financial Year ${r.year}: Income is ${r.income} Lakhs, Net Profit is ${r.profit} Lakhs, Net Loss is ${r.loss} Lakhs. Audited and certified by CA Keerthiga Sri J.M.`
  );

  const allChunks = [metadataChunk, summaryChunk, ...yearChunks];
  console.log(`Generating 768-dim embeddings for ${allChunks.length} chunks...`);
  const vectors = await embedMany(allChunks);

  const { error: cErr } = await supabase.from("chunks").insert(
    allChunks.map((content, i) => ({
      client_id: clientId,
      content,
      embedding: vectors[i] as unknown as string,
    }))
  );
  if (cErr) throw cErr;

  console.log("Successfully seeded Apex Enterprises Pvt Ltd with 10 years of audit records!");
}

seed().catch((e) => {
  console.error("Seed error:", e);
  process.exit(1);
});
