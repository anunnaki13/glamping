"use client";

import { Printer } from "lucide-react";

export function PrintInvoiceButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-4 text-sm font-black text-[#b8fbff] print:hidden"
    >
      <Printer className="size-5" />
      Print Invoice
    </button>
  );
}
