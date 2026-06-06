import Link from "next/link";
import { ArrowLeft, Mail, MessageCircle, Plus, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { createGuestAction } from "@/app/guests/actions";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { requirePagePermission } from "@/lib/action-guard";

export const dynamic = "force-dynamic";

type NewGuestPageProps = {
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function NewGuestPage({ searchParams }: NewGuestPageProps) {
  await requirePagePermission("guest:sensitive");
  const feedback = getActionFeedback(await searchParams);

  return (
    <AppShell>
      <Link href="/guests" className="inline-flex items-center gap-2 text-sm font-bold text-[#b8fbff]">
        <ArrowLeft className="size-4" />
        Kembali ke Guest CRM
      </Link>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <GlassCard variant="strong" className="p-6">
          <div className="grid size-16 place-items-center rounded-[24px] border border-[#29f1ff]/24 bg-[#29f1ff]/12 text-[#b8fbff]">
            <UserRound className="size-8" />
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-normal text-white">Tambah Guest Profile</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/62">
            Data tamu dipakai untuk CRM, komunikasi, dan riwayat stay.
          </p>
          <div className="mt-6 grid gap-3">
            <div className="surface-inset flex items-center gap-3 rounded-[22px] p-4">
              <MessageCircle className="size-5 text-[#29f1ff]" />
              <span className="text-sm font-bold text-white/72">WhatsApp-ready contact</span>
            </div>
            <div className="surface-inset flex items-center gap-3 rounded-[22px] p-4">
              <Mail className="size-5 text-[#b8fbff]" />
              <span className="text-sm font-bold text-white/72">Email and ID reference</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <form action={createGuestAction} className="grid gap-4 xl:grid-cols-2">
            <TextField label="Nama lengkap" name="fullName" placeholder="Aria Wibowo" required />
            <TextField label="Guest type" name="guestType" placeholder="VIP / Couple / Family" defaultValue="GENERAL" required />
            <TextField label="Phone / WhatsApp" name="phone" placeholder="+62..." />
            <TextField label="Email" name="email" type="email" placeholder="guest@email.com" />
            <TextField label="Country" name="country" placeholder="Indonesia" />
            <TextField label="City" name="city" placeholder="Jakarta" />
            <TextField label="ID type" name="idType" placeholder="KTP / Passport" />
            <TextField label="ID number" name="idNumber" placeholder="Masked in list view" />
            <TextArea label="Preferences" name="preferences" placeholder="High view, vegetarian breakfast, soft pillow..." />
            <TextArea label="Internal notes" name="notes" placeholder="Catatan staff internal." />
            <div className="xl:col-span-2">
              <button className="gold-gradient inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-[#041015]">
                <Plus className="size-5" />
                Simpan Guest
              </button>
            </div>
          </form>
        </GlassCard>
      </section>
    </AppShell>
  );
}

function fieldClass() {
  return "mt-2 min-h-12 w-full rounded-[22px] surface-field px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/34 focus:border-[#29f1ff]/50";
}

function TextField(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <input className={fieldClass()} {...inputProps} />
    </label>
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) {
  const { label, ...textareaProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <textarea className={`${fieldClass()} min-h-28 py-3`} {...textareaProps} />
    </label>
  );
}
