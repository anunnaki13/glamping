import { NextRequest, NextResponse } from "next/server";
import type { ActionFeedback } from "@/lib/action-feedback";

export function redirectToLogin(request: NextRequest, nextPath: string) {
  const params = new URLSearchParams({ next: nextPath });
  return NextResponse.redirect(new URL(`/login?${params.toString()}`, request.url), 303);
}

export function redirectWithRouteFeedback(request: NextRequest, path: string, feedback: ActionFeedback) {
  const [pathname, queryString = ""] = path.split("?");
  const params = new URLSearchParams(queryString);
  params.set("actionStatus", feedback.status);
  params.set("actionMessage", feedback.message);

  return NextResponse.redirect(new URL(`${pathname}?${params.toString()}`, request.url), 303);
}
