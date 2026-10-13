import { NextRequest, NextResponse } from "next/server";

export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigin = process.env.CORS_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin === "*" ? "*" : (origin || "*"),
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, Accept, Origin, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

export function handleCorsPreflight(req?: Request | NextRequest): NextResponse {
  const origin = req ? req.headers.get("origin") : null;
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export function apiResponse(data: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  const cors = getCorsHeaders();
  for (const [key, value] of Object.entries(cors)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  return NextResponse.json(data, { ...init, headers });
}

export function apiError(
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): NextResponse {
  return apiResponse(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

/**
 * Lightweight edge-compatible header check for middleware
 */
export function verifyBasicApiKey(req: Request | NextRequest): { authorized: boolean; reason?: string } {
  const envKey = process.env.API_KEY?.trim();
  const appPassword = process.env.APP_PASSWORD?.trim();

  // If no environment keys are set, allow through to route handler
  if (!envKey && !appPassword) {
    return { authorized: true };
  }

  const xApiKey = req.headers.get("x-api-key")?.trim();
  if (envKey && xApiKey && xApiKey === envKey) {
    return { authorized: true };
  }

  const authHeader = req.headers.get("authorization")?.trim();
  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if ((envKey && token === envKey) || (appPassword && token === appPassword)) {
        return { authorized: true };
      }
    }
  }

  return { authorized: true }; // Let route handler perform full database / local store key validation
}
