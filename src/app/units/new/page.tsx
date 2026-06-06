import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { UnitStatus } from "@/generated/prisma/enums";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { createUnitAction, createUnitTypeAction } from "@/app/units/actions";
import { requirePagePermission } from "@/lib/action-guard";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { formatIdr } from "@/lib/formatters";
import { unitStatusLabels, unitStatusTone } from "@/lib/labels";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type NewUnitPageProps = {
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function NewUnitPage({ searchParams }: NewUnitPageProps) {
  const session = await requirePagePermission("unit:write");
  const feedback = getActionFeedback(await searchParams);
  const unitTypes = await getPrisma().unitType.findMany({
    where: { propertyId: session.propertyId },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/units" className="inline-flex items-center gap-2 text-sm font-bold text-[#b8fbff]">
            <ArrowLeft className="size-4" />
            Kembali ke Units
          </Link>
          <h2 className="mt-4 text-3xl font-black tracking-normal text-white">Tambah Unit</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Buat tipe unit baru bila diperlukan, lalu daftarkan unit operasional ke board.
          </p>
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <GlassCard variant="strong" className="p-5">
          <h3 className="text-xl font-black text-white">Create Unit Type</h3>
          <p className="mt-2 text-sm leading-6 text-white/58">Gunakan untuk grouping rate dan kapasitas unit.</p>
          <form action={createUnitTypeAction} className="mt-5 space-y-4">
            <TextField label="Nama tipe" name="name" placeholder="Premium Dome" required />
            <TextArea label="Deskripsi" name="description" placeholder="Premium dome dengan view utama." />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Kapasitas" name="capacity" type="number" min="1" defaultValue="2" required />
              <TextField label="Base rate" name="baseRate" type="number" min="0" defaultValue="1900000" required />
            </div>
            <button className="gold-gradient inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-[#041015]">
              <Plus className="size-5" />
              Simpan Unit Type
            </button>
          </form>
        </GlassCard>

        <GlassCard variant="strong" className="p-5">
          <h3 className="text-xl font-black text-white">Create Unit</h3>
          <p className="mt-2 text-sm leading-6 text-white/58">Unit aktif akan muncul di room status board dan future reservation flow.</p>
          <form action={createUnitAction} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Kode unit" name="code" placeholder="PD-03" required />
              <TextField label="Nama unit" name="name" placeholder="Premium Dome 03" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Unit type" name="unitTypeId" required>
                {unitTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} · {formatIdr(Number(type.baseRate))}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Status awal" name="status" defaultValue={UnitStatus.AVAILABLE} required>
                {Object.values(UnitStatus).map((status) => (
                  <option key={status} value={status}>
                    {unitStatusLabels[status]}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FileField label="Upload foto" name="photo" />
              <TextField label="Photo URL / path" name="photoUrl" placeholder="/uploads/demo/unit-geodesic-dome-forest.jpg" />
            </div>
            <TextArea label="Amenities" name="amenities" placeholder="Private deck, Wi-Fi, Breakfast" />
            <TextArea label="Deskripsi" name="description" placeholder="Catatan konsep unit." />
            <TextArea label="Notes internal" name="notes" placeholder="Catatan staff internal." />

            <div className="flex flex-wrap gap-2">
              {Object.values(UnitStatus).map((status) => (
                <StatusBadge key={status} label={unitStatusLabels[status]} tone={unitStatusTone[status]} dot />
              ))}
            </div>

            <button className="gold-gradient inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-[#041015]">
              <Plus className="size-5" />
              Simpan Unit
            </button>
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

function FileField(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={`${fieldClass()} pt-3 file:mr-3 file:rounded-[14px] file:border-0 file:bg-white/12 file:px-3 file:py-1.5 file:text-xs file:font-black file:text-white`}
        {...inputProps}
      />
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

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string }) {
  const { label, children, ...selectProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <select className={fieldClass()} {...selectProps}>
        {children}
      </select>
    </label>
  );
}
