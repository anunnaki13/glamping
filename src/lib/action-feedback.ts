import { redirect } from "next/navigation";
import { ZodError } from "zod";

export type ActionFeedbackStatus = "success" | "error";

export type ActionFeedback = {
  status: ActionFeedbackStatus;
  message: string;
};

export type ActionFeedbackSearchParams = {
  actionStatus?: string;
  actionMessage?: string;
};

export function buildActionFeedbackPath(path: string, feedback: ActionFeedback) {
  const [pathname, queryString = ""] = path.split("?");
  const params = new URLSearchParams(queryString);
  params.set("actionStatus", feedback.status);
  params.set("actionMessage", feedback.message);

  return `${pathname}?${params.toString()}`;
}

export function redirectWithActionError(path: string, error: unknown, fallback = "Aksi belum dapat diproses."): never {
  redirect(buildActionFeedbackPath(path, { status: "error", message: getActionErrorMessage(error, fallback) }));
}

export function redirectWithActionSuccess(path: string, message: string): never {
  redirect(buildActionFeedbackPath(path, { status: "success", message }));
}

export function getActionFeedback(params: ActionFeedbackSearchParams): ActionFeedback | null {
  const status = params.actionStatus === "success" || params.actionStatus === "error" ? params.actionStatus : null;
  const message = params.actionMessage?.trim();

  if (!status || !message) {
    return null;
  }

  return { status, message: message.slice(0, 240) };
}

export function getActionErrorMessage(error: unknown, fallback = "Aksi belum dapat diproses.") {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error instanceof ZodError) {
    return "Form belum lengkap atau ada nilai yang tidak valid.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
