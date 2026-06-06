import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";
import { getCurrentSession } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function POST() {
  const session = await getCurrentSession();
  const response = NextResponse.json({ message: "Logout berhasil." });

  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  if (session) {
    try {
      await getPrisma().activityLog.create({
        data: {
          actorId: session.userId,
          action: "logout",
          entityType: "User",
          entityId: session.userId,
          description: `${session.name} logged out.`,
        },
      });
    } catch (error) {
      console.error("Logout activity log failed", error);
    }
  }

  return response;
}
