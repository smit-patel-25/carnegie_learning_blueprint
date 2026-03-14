import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  void request;
  // Keep middleware edge-safe for deployment. Route protection is enforced server-side.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

