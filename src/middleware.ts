import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const development = process.env.NODE_ENV === "development";
  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://tile.openstreetmap.org",
    "font-src 'self' data:",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
  ].join("; ");
  const headers = new Headers(request.headers);
  // Next reads this request header to attach the nonce to framework scripts.
  // Always replace caller-supplied CSP values.
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  if (
    ["/", "/login", "/find", "/results"].includes(request.nextUrl.pathname) ||
    request.nextUrl.pathname.startsWith("/providers/")
  )
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  if (!development)
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
