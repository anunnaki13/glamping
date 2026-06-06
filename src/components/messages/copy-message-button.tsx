"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type CopyMessageButtonProps = {
  text: string;
};

export function CopyMessageButton({ text }: CopyMessageButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copyText}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[16px] surface-chip px-3 text-xs font-black text-white/78 transition hover:border-[#29f1ff]/30 hover:text-[#b8fbff]"
    >
      {copied ? <Check className="size-4 text-emerald-200" /> : <Copy className="size-4" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
