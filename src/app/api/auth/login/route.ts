import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";
import { createSessionToken, getSessionCookieOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  remember: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isFormSubmit = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
  const parsed = loginSchema.safeParse(await readLoginPayload(request, isFormSubmit));
  const nextPath = getSafeNextPath(new URL(request.url).searchParams.get("next"));

  if (!parsed.success) {
    if (isFormSubmit) {
      return NextResponse.redirect(getRedirectUrl(request, "/login?error=invalid"), { status: 303 });
    }

    return NextResponse.json({ message: "Email atau kata sandi tidak sesuai." }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: { property: true },
    });

    if (!user || !user.isActive) {
      if (isFormSubmit) {
        return NextResponse.redirect(getRedirectUrl(request, "/login?error=credentials"), { status: 303 });
      }

      return NextResponse.json({ message: "Email atau kata sandi tidak sesuai." }, { status: 401 });
    }

    const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);

    if (!passwordValid) {
      if (isFormSubmit) {
        return NextResponse.redirect(getRedirectUrl(request, "/login?error=credentials"), { status: 303 });
      }

      return NextResponse.json({ message: "Email atau kata sandi tidak sesuai." }, { status: 401 });
    }

    const session = {
      userId: user.id,
      propertyId: user.propertyId,
      propertyName: user.property.name,
      propertySlug: user.property.slug,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = await createSessionToken(session, parsed.data.remember);
    const response = isFormSubmit
      ? NextResponse.redirect(getRedirectUrl(request, nextPath), { status: 303 })
      : NextResponse.json({
          user: session,
          message: "Login berhasil.",
        });

    response.cookies.set(AUTH_COOKIE_NAME, token, getSessionCookieOptions(parsed.data.remember, isSecureRequest(request)));

    await prisma.activityLog.create({
      data: {
        actorId: user.id,
        action: "login",
        entityType: "User",
        entityId: user.id,
        description: `${user.name} logged in.`,
      },
    });

    return response;
  } catch (error) {
    console.error("Login failed", error);
    if (isFormSubmit) {
      return NextResponse.redirect(getRedirectUrl(request, "/login?error=database"), { status: 303 });
    }

    return NextResponse.json(
      { message: "Login belum dapat diproses. Periksa koneksi database." },
      { status: 503 },
    );
  }
}

async function readLoginPayload(request: Request, isFormSubmit: boolean) {
  if (!isFormSubmit) {
    return request.json().catch(() => null);
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return null;
  }

  return {
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember") === "on",
  };
}

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

function getRedirectUrl(request: Request, path: string) {
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return new URL(path, request.url);
  }

  return new URL(path, `${protocol}://${host}`);
}

function isSecureRequest(request: Request) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto");

  if (forwardedProtocol) {
    return forwardedProtocol.split(",")[0]?.trim() === "https";
  }

  return new URL(request.url).protocol === "https:";
}
