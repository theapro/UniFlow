import { NextRequest, NextResponse } from "next/server";

function isPublicPath(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname === "/receptionist" || pathname.startsWith("/receptionist/")) {
    return true;
  }
  if (pathname.startsWith("/3dleia")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;
  const receptionistConversationId = request.cookies.get(
    "receptionistConversationId",
  )?.value;

  // Public paths are always allowed
  if (isPublicPath(pathname)) {
    // If user is already authenticated and tries to access /login, redirect to dashboard
    if (pathname === "/login" && token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // SSR-first conversation persistence for the public receptionist page.
    if (
      (pathname === "/receptionist" || pathname.startsWith("/receptionist/")) &&
      !receptionistConversationId
    ) {
      const id = crypto.randomUUID();

      // Make the cookie available to the current request (SSR) by forwarding an
      // updated Cookie header, and also persist it to the browser via Set-Cookie.
      const headers = new Headers(request.headers);
      const existing = headers.get("cookie");
      headers.set(
        "cookie",
        existing
          ? `${existing}; receptionistConversationId=${id}`
          : `receptionistConversationId=${id}`,
      );

      const res = NextResponse.next({ request: { headers } });
      res.cookies.set({
        name: "receptionistConversationId",
        value: id,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    return NextResponse.next();
  }

  // Protect everything else
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    loginUrl.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
