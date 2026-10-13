import { supabase } from "@/lib/supabase";
import { apiResponse, apiError, handleCorsPreflight } from "@/lib/cors";
import { verifyApiKeyRequest } from "@/lib/api-keys";

export const runtime = "nodejs";

type Context = { params: { id: string } };

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET(req: Request, { params }: Context) {
  try {
    const auth = await verifyApiKeyRequest(req);
    if (!auth.authorized) {
      return apiError(auth.reason || "Unauthorized", 401);
    }

    const id = params.id;
    if (!id) return apiError("Client ID is required.", 400);

    const { data: client, error } = await supabase
      .from("clients")
      .select("id, name, email")
      .eq("id", id)
      .maybeSingle();

    if (error || !client) {
      return apiError("Client not found.", 404);
    }

    const [{ data: financials }, { count: chunksCount }] = await Promise.all([
      supabase
        .from("financials")
        .select("year, income, profit, loss")
        .eq("client_id", id)
        .order("year", { ascending: true }),
      supabase
        .from("chunks")
        .select("*", { count: "exact", head: true })
        .eq("client_id", id),
    ]);

    return apiResponse({
      success: true,
      client,
      stats: {
        financialYearsCount: (financials || []).length,
        documentChunksCount: chunksCount ?? 0,
        hasDocumentIndexed: (chunksCount ?? 0) > 0,
      },
      financials: financials || [],
    });
  } catch (err: any) {
    return apiError(err?.message || "Failed to retrieve client.", 500);
  }
}

export async function PATCH(req: Request, { params }: Context) {
  try {
    const auth = await verifyApiKeyRequest(req);
    if (!auth.authorized) {
      return apiError(auth.reason || "Unauthorized", 401);
    }

    const id = params.id;
    const body = await req.json();
    const updateData: Record<string, any> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      updateData.name = body.name.trim();
    }
    if (typeof body.email === "string") {
      updateData.email = body.email.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return apiError("No valid fields provided to update (name, email).", 400);
    }

    const { data, error } = await supabase
      .from("clients")
      .update(updateData)
      .eq("id", id)
      .select("id, name, email")
      .single();

    if (error) return apiError(error.message, 500);

    return apiResponse({
      success: true,
      message: "Client updated successfully.",
      client: data,
    });
  } catch (err: any) {
    return apiError(err?.message || "Failed to update client.", 500);
  }
}

export async function DELETE(req: Request, { params }: Context) {
  try {
    const auth = await verifyApiKeyRequest(req);
    if (!auth.authorized) {
      return apiError(auth.reason || "Unauthorized", 401);
    }

    const id = params.id;
    if (!id) return apiError("Client ID is required.", 400);

    // Clean up dependent records
    await supabase.from("chunks").delete().eq("client_id", id);
    await supabase.from("financials").delete().eq("client_id", id);

    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return apiError(error.message, 500);

    return apiResponse({
      success: true,
      message: `Client ${id} and all related audit financials/chunks deleted.`,
    });
  } catch (err: any) {
    return apiError(err?.message || "Failed to delete client.", 500);
  }
}
