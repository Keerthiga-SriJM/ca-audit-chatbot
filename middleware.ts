import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "./lib/cors";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith("/api");

  // 1) Handle CORS Preflight for all API routes
  if (isApiRoute && req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(req.headers.get("origin")),
    });
  }

  // 2) Attach CORS headers to all API responses
  if (isApiRoute) {
    const res = NextResponse.next();
    const cors = getCorsHeaders(req.headers.get("origin"));
    for (const [key, value] of Object.entries(cors)) {
      res.headers.set(key, value);
    }
    return res;
  }

  // 3) Non-API routes: Optional basic auth password gate for the browser UI
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (given === password) return NextResponse.next();
    } catch {
      // invalid base64
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="CA Audit Chatbot"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
