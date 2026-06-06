"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ActionButton } from "@/components/ui/action-button";

const loginFormSchema = z.object({
  email: z.string().email("Email tidak valid."),
  password: z.string().min(1, "Password wajib diisi."),
  remember: z.boolean(),
});

const defaultLoginValues = {
  email: "owner@nusaescape.local",
  password: "password123",
  remember: true,
};

type LoginFormValues = z.infer<typeof loginFormSchema>;

export function LoginForm() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: defaultLoginValues,
  });

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const body = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setFormError(body?.message ?? "Email atau kata sandi tidak sesuai.");
        return;
      }

      toast.success(body?.message ?? "Login berhasil.");
      const nextPath = searchParams.get("next") ?? "/dashboard";
      window.location.assign(nextPath.startsWith("/") ? nextPath : "/dashboard");
    } catch {
      setFormError("Login gagal dijalankan dari browser. Coba refresh halaman lalu masuk kembali.");
    }
  }

  return (
    <form
      action={`/api/auth/login?next=${encodeURIComponent(searchParams.get("next") ?? "/dashboard")}`}
      className="mt-8 space-y-4"
      method="post"
      onSubmit={handleSubmit(onSubmit)}
    >
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-normal text-white/58">Email</span>
        <span className="mt-2 flex min-h-12 items-center gap-3 rounded-[var(--radius-input)] border border-white/12 bg-white/[0.07] px-4 focus-within:border-[#29f1ff]/50">
          <Mail className="size-5 text-[#29f1ff]" />
          <input
            type="email"
            autoComplete="email"
            className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/38"
            defaultValue={defaultLoginValues.email}
            placeholder="email@nusaescape.id"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </span>
        {errors.email ? <p className="mt-2 text-xs font-semibold text-red-200">{errors.email.message}</p> : null}
      </label>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-normal text-white/58">Password</span>
        <span className="mt-2 flex min-h-12 items-center gap-3 rounded-[var(--radius-input)] border border-white/12 bg-white/[0.07] px-4 focus-within:border-[#29f1ff]/50">
          <LockKeyhole className="size-5 text-[#29f1ff]" />
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/38"
            defaultValue={defaultLoginValues.password}
            placeholder="Masukkan password"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
          <button
            type="button"
            className="text-white/45 transition hover:text-white"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </span>
        {errors.password ? <p className="mt-2 text-xs font-semibold text-red-200">{errors.password.message}</p> : null}
      </label>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 font-semibold text-white/64">
          <input type="checkbox" className="size-4 accent-[#29f1ff]" defaultChecked={defaultLoginValues.remember} {...register("remember")} />
          Remember me
        </label>
        <a href="mailto:owner@nusaescape.local?subject=Smart%20Glamping%20OS%20Access" className="font-bold text-[#b8fbff]">
          Bantuan akses
        </a>
      </div>

      {formError ? (
        <div className="rounded-[22px] border border-red-300/20 bg-red-500/10 p-3 text-sm font-semibold text-red-100">
          {formError}
        </div>
      ) : null}

      <ActionButton type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Memproses..." : "Masuk"}
      </ActionButton>
    </form>
  );
}
