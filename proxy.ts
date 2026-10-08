import { NextResponse, type NextRequest } from "next/server";
import { isAllowedRequestOrigin } from "@/lib/request-origin";

// Route Handlers still enforce sessions, roles, branches and assignment.
// Better Auth applies its own origin/CSRF checks on /api/auth.
export function proxy(request: NextRequest) {
  if (
    !["POST", "PUT", "PATCH", "DELETE"].includes(request.method) ||
    request.nextUrl.pathname.startsWith("/api/auth/")
  )
    return NextResponse.next();
  if (!isAllowedRequestOrigin(request, process.env.APP_URL)) {
    return NextResponse.json(
      {
        error: {
          code: "CROSS_SITE_REQUEST",
          message: "Permintaan lintas situs tidak diizinkan.",
        },
      },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
