import { Suspense } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, CalendarCheck, MoonStar, RadioTower } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { GlassCard } from "@/components/ui/glass-card";

const errorMessages: Record<string, string> = {
  credentials: "Email atau kata sandi tidak sesuai.",
  database: "Login belum dapat diproses. Periksa koneksi database.",
  invalid: "Format login tidak valid.",
};

const loginMetrics: Array<{ label: string; value: string; icon: LucideIcon }> = [
  { label: "Occupancy", value: "84%", icon: Activity },
  { label: "Arrivals", value: "12", icon: CalendarCheck },
  { label: "Systems", value: "Live", icon: RadioTower },
];

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : null;

  return (
    <main className="grid min-h-screen place-items-center p-4 text-white lg:p-8">
      <div className="grid w-full max-w-7xl overflow-hidden rounded-[var(--radius-shell)] border border-white/12 bg-[var(--bg-shell)] shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl lg:grid-cols-[1.18fr_0.82fr]">
        <section className="relative hidden min-h-[720px] overflow-hidden border-r border-white/10 p-8 lg:block">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(41,241,255,0.10),transparent_38%),linear-gradient(215deg,rgba(169,137,255,0.08),transparent_36%),linear-gradient(180deg,rgba(7,16,23,0.42),rgba(4,9,13,0.88))]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px] opacity-80" />
            <div className="absolute bottom-12 left-10 right-10 grid gap-4">
              <div className="grid grid-cols-3 gap-4">
                {loginMetrics.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-[var(--radius-panel)] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-2xl">
                    <Icon className="size-5 text-[#29f1ff]" />
                    <p className="mt-5 text-xs font-bold uppercase tracking-normal text-white/42">{label}</p>
                    <p className="mt-1 text-2xl font-black text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-[var(--radius-panel)] border border-[#29f1ff]/14 bg-[#29f1ff]/[0.055] p-5 backdrop-blur-2xl">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">Command Readiness</p>
                  <p className="text-xs font-black text-[#b8fbff]">LIVE</p>
                </div>
                <div className="mt-5 space-y-3">
                  {["Reservations synced", "Housekeeping queue ready", "Service requests online"].map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-[18px] border border-white/10 bg-black/12 px-3 py-2.5">
                      <span className="text-xs font-semibold text-white/64">{item}</span>
                      <span className="size-2 rounded-full bg-[#29f1ff] shadow-[0_0_14px_rgba(41,241,255,0.62)]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex h-full flex-col justify-between">
            <BrandLockup />
            <div className="max-w-2xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-4 py-2 text-sm font-bold text-[#b8fbff]">
                <MoonStar className="size-4" />
                Premium eco-resort command center
              </div>
              <h1 className="max-w-xl text-5xl font-black leading-[1.04] tracking-normal text-white">
                Smart Glamping OS
              </h1>
              <p className="mt-6 max-w-lg text-lg font-medium leading-8 text-white/68">
                Live cockpit untuk reservasi, unit, housekeeping, layanan tamu, dan revenue.
              </p>
            </div>
          </div>
        </section>

        <section className="grid min-h-screen place-items-center p-5 lg:min-h-[720px] lg:p-10">
          <GlassCard variant="strong" className="w-full max-w-md p-6 md:p-8">
            <div className="mb-8 lg:hidden">
              <BrandLockup />
            </div>
            <div>
              <p className="text-sm font-bold text-[#29f1ff]">Selamat datang kembali</p>
              <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Masuk ke dashboard</h2>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Gunakan akun operasional Nusa Escape untuk melanjutkan.
              </p>
            </div>

            <Suspense fallback={<div className="mt-8 h-72 animate-pulse rounded-3xl bg-white/[0.065]" />}>
              <LoginForm />
            </Suspense>

            {errorMessage ? (
              <div className="mt-4 rounded-[22px] border border-red-300/20 bg-red-500/10 p-3 text-sm font-semibold text-red-100">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-6 rounded-[22px] border border-[#29f1ff]/16 bg-[#29f1ff]/8 p-4 text-xs leading-6 text-white/60">
              <p className="font-bold text-[#b8fbff]">Development credentials</p>
              <p>owner@nusaescape.local / password123</p>
            </div>
          </GlassCard>
        </section>
      </div>
    </main>
  );
}
