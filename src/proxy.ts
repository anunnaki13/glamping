import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";

const protectedPrefixes = [
  "/activity",
  "/dashboard",
  "/reservations",
  "/calendar",
  "/units",
  "/guests",
  "/messages",
  "/ai",
  "/catalog",
  "/check-in",
  "/check-out",
  "/housekeeping",
  "/service-requests",
  "/orders",
  "/reports",
  "/settings",
];

function getSecretKey() {
  const secret = process.env.AUTH_SECRET ?? "dev-only-change-this-secret-before-production";
  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const sessionValid = await hasValidSession(request);

  if (pathname === "/login" && sessionValid) {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }

  if (isProtected && !sessionValid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", getLoginNextPath(request));
    return NextResponse.redirect(loginUrl, 303);
  }

  return NextResponse.next();
}

function getLoginNextPath(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/reports/export") {
    return `/reports${search}`;
  }

  if (pathname === "/activity/export") {
    return `/activity${search}`;
  }

  return `${pathname}${search}`;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
