import { supabase } from "@/lib/supabase";
import { apiResponse, apiError, handleCorsPreflight } from "@/lib/cors";
import { verifyApiKeyRequest } from "@/lib/api-keys";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET(req: Request) {
  try {
    const auth = await verifyApiKeyRequest(req);
    if (!auth.authorized) {
      return apiError(auth.reason || "Unauthorized", 401);
    }

    const url = new URL(req.url);
    const includeStats = url.searchParams.get("stats") === "true";

    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, name, email")
      .order("name");

    if (error) return apiError(error.message, 500);

    if (includeStats && clients) {
      // Enrich with financial year counts and chunks count
      const enriched = await Promise.all(
        clients.map(async (c) => {
          const [{ count: yearsCount }, { count: chunksCount }] = await Promise.all([
            supabase
              .from("financials")
              .select("*", { count: "exact", head: true })
              .eq("client_id", c.id),
            supabase
              .from("chunks")
              .select("*", { count: "exact", head: true })
              .eq("client_id", c.id),
          ]);
          return {
            ...c,
            financialYearsAudited: yearsCount ?? 0,
            documentChunks: chunksCount ?? 0,
            hasDocuments: (chunksCount ?? 0) > 0,
          };
        })
      );
      return apiResponse({ success: true, count: enriched.length, clients: enriched });
    }

    return apiResponse({ success: true, count: (clients || []).length, clients: clients || [] });
  } catch (err: any) {
    return apiError(err?.message || "Failed to fetch clients", 500);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyApiKeyRequest(req);
    if (!auth.authorized) {
      return apiError(auth.reason || "Unauthorized", 401);
    }

    const body = await req.json();
    const name = body.name?.trim();
    const email = body.email?.trim() || null;

    if (!name) {
      return apiError("Client name is required.", 400);
    }

    // Check if client name already exists
    const { data: existing } = await supabase
      .from("clients")
      .select("id, name, email")
      .ilike("name", name)
      .maybeSingle();

    if (existing) {
      return apiResponse(
        {
          success: true,
          message: "Client already registered.",
          client: existing,
          created: false,
        },
        { status: 200 }
      );
    }

    const { data, error } = await supabase
      .from("clients")
      .insert({ name, email })
      .select("id, name, email")
      .single();

    if (error) return apiError(error.message, 500);

    return apiResponse(
      {
        success: true,
        message: "Client registered successfully.",
        client: data,
        created: true,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return apiError(err?.message || "Failed to create client", 500);
  }
}
