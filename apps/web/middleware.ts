import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hasSessionCookie = Boolean(request.cookies.get("qr_session")?.value);
  if (!hasSessionCookie) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/kitchen/:path*", "/waiter/:path*"] };
