import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "uz"];
const defaultLocale = "en";

// Public paths that don't require authentication
const publicPaths = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

function getLocale(request: NextRequest): string {
  // Check if locale is in pathname
  const pathname = request.nextUrl.pathname;
  const pathnameLocale = locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (pathnameLocale) return pathnameLocale;

  // Check Accept-Language header
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const locale = locales.find((l) => acceptLanguage.includes(l));
    if (locale) return locale;
  }

  return defaultLocale;
}

function isPublicPath(pathname: string): boolean {
  // Remove locale prefix to check path
  const pathWithoutLocale = pathname.replace(/^\/(en|uz)/, "");
  return publicPaths.some((path) => pathWithoutLocale.startsWith(path));
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Root redirect
  if (pathname === "/") {
    const locale = getLocale(request);
    const token =
      request.cookies.get("token")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");
    return NextResponse.redirect(
      new URL(`/${locale}/${token ? "dashboard" : "login"}`, request.url),
    );
  }

  // Check if pathname already has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (!pathnameHasLocale) {
    // Redirect if there is no locale
    const locale = getLocale(request);
    request.nextUrl.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  // Check authentication for protected routes
  const token =
    request.cookies.get("token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");
  const isPublic = isPublicPath(pathname);

  // If accessing dashboard without token, redirect to login
  if (!isPublic && pathname.includes("/dashboard") && !token) {
    const locale = getLocale(request);
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("from", pathname);
    loginUrl.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(loginUrl);
  }

  // If accessing login/signup with token, redirect to dashboard
  if (isPublic && token && pathname.includes("/login")) {
    const locale = getLocale(request);
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip all internal paths (_next, api, static files)
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|monitoring).*)",
  ],
};
