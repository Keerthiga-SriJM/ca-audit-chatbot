import { NextRequest } from "next/server";
import {
  listApiKeys,
  createApiKey,
  toggleApiKey,
  deleteApiKey,
} from "@/lib/api-keys";
import { apiResponse, apiError, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleCorsPreflight();
}

/**
 * GET /api/keys
 * Lists all API keys (masked) with usage metrics
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const showFull = url.searchParams.get("full") === "true";
    const keys = await listApiKeys(!showFull);
    return apiResponse({
      success: true,
      count: keys.length,
      keys,
    });
  } catch (err: any) {
    return apiError(err?.message || "Failed to retrieve API keys", 500);
  }
}

/**
 * POST /api/keys
 * Generates and saves a new API key
 * Body: { name?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = body.name?.trim() || "Client API Key";

    const newKeyRecord = await createApiKey(name);

    return apiResponse(
      {
        success: true,
        message: "API key created successfully! Copy and save it now — you can share it with your users.",
        key: newKeyRecord.key,
        keyRecord: newKeyRecord,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return apiError(err?.message || "Failed to create API key", 500);
  }
}

/**
 * PATCH /api/keys
 * Toggles an API key's active / revoked state
 * Body: { id: string, isActive: boolean }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; isActive?: boolean };
    if (!body.id) {
      return apiError("Missing 'id' parameter.", 400);
    }

    const success = await toggleApiKey(body.id, body.isActive !== false);
    return apiResponse({
      success,
      message: body.isActive !== false ? "API key activated." : "API key revoked.",
    });
  } catch (err: any) {
    return apiError(err?.message || "Failed to update API key", 500);
  }
}

/**
 * DELETE /api/keys
 * Deletes an API key
 * Query or Body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    let id = new URL(req.url).searchParams.get("id");
    if (!id) {
      const body = (await req.json().catch(() => ({}))) as { id?: string };
      id = body.id || null;
    }

    if (!id) {
      return apiError("Missing 'id' parameter.", 400);
    }

    const success = await deleteApiKey(id);
    return apiResponse({
      success,
      message: "API key deleted permanently.",
    });
  } catch (err: any) {
    return apiError(err?.message || "Failed to delete API key", 500);
  }
}
