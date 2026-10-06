import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { BrandLogo } from "@/components/brand-logo";
import { QrisPromo } from "@/components/qris-promo";
import { Badge } from "@/components/ui/badge";
import { getActor } from "@/lib/session";

export default async function LoginPage() {
  if (await getActor()) redirect("/dashboard");
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_.85fr]">
      <section className="relative hidden overflow-hidden bg-brand-deep p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative">
          <BrandLogo className="mb-16 max-w-[300px]" sizes="300px" />
          <h1 className="max-w-xl text-5xl font-black leading-[1.08] tracking-tight">
            Satu alur kerja.
            <br />
            <span className="text-accent">Sampai benar-benar digunakan.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-blue-100">
            Menghubungkan prospek, tindak lanjut, serah terima out-branch–CS,
            onboarding, dan verifikasi penggunaan.
          </p>
        </div>
        <div className="relative text-sm text-blue-200">
          KCP Mandiri Jakarta Mangga Besar · 11539 · B.2
        </div>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <BrandLogo className="max-w-[250px]" sizes="250px" />
          </div>
          <Badge tone="blue">Akses internal</Badge>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
            Selamat datang
          </h2>
          <p className="mb-7 mt-2 text-sm leading-6 text-slate-500">
            Masuk menggunakan akun internal yang telah diberikan kewenangan.
          </p>
          <div className="card p-5 sm:p-7">
            <LoginForm />
          </div>
          <div className="mt-5">
            <QrisPromo compact />
          </div>
          <p className="mt-5 text-center text-xs leading-5 text-slate-400">
            KCP Mandiri Jakarta Mangga Besar · 11539 · B.2
          </p>
        </div>
      </section>
    </main>
  );
}
