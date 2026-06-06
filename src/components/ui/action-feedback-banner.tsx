import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ActionFeedback } from "@/lib/action-feedback";

export function ActionFeedbackBanner({ feedback }: { feedback: ActionFeedback | null }) {
  if (!feedback) {
    return null;
  }

  const isSuccess = feedback.status === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={
        isSuccess
          ? "mt-5 rounded-[24px] border border-emerald-300/20 bg-emerald-400/10 p-4 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "mt-5 rounded-[24px] border border-red-300/22 bg-red-500/10 p-4 text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      }
      role={isSuccess ? "status" : "alert"}
    >
      <div className="flex items-start gap-3">
        <div className={isSuccess ? "grid size-10 shrink-0 place-items-center rounded-[18px] bg-emerald-300/14" : "grid size-10 shrink-0 place-items-center rounded-[18px] bg-red-300/14"}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="font-black text-white">{isSuccess ? "Aksi tersimpan" : "Aksi gagal"}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-white/68">{feedback.message}</p>
        </div>
      </div>
    </div>
  );
}
