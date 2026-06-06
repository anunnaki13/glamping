import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import {
  AUTH_COOKIE_NAME,
  DEFAULT_SESSION_MAX_AGE,
  REMEMBER_SESSION_MAX_AGE,
} from "@/lib/auth-constants";

export const authSessionSchema = z.object({
  userId: z.string(),
  propertyId: z.string(),
  propertyName: z.string(),
  propertySlug: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["OWNER", "MANAGER", "FRONT_OFFICE", "HOUSEKEEPING", "FNB_ACTIVITY", "VIEWER"]),
});

export type AuthSession = z.infer<typeof authSessionSchema>;

function getSecretKey() {
  const secret = process.env.AUTH_SECRET ?? "dev-only-change-this-secret-before-production";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: AuthSession, remember = false) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${remember ? REMEMBER_SESSION_MAX_AGE : DEFAULT_SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return authSessionSchema.parse(payload);
  } catch {
    return null;
  }
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export function getSessionCookieOptions(remember = false) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? REMEMBER_SESSION_MAX_AGE : DEFAULT_SESSION_MAX_AGE,
  };
}
