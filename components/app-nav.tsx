"use client";

import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  QrCode,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useFeedback } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";

const items = [
  { href: "/dashboard", label: "Beranda", icon: LayoutDashboard },
  {
    href: "/work",
    label: "Akuisisi Nasabah",
    mobileLabel: "Akuisisi",
    icon: BriefcaseBusiness,
  },
  {
    href: "/appointment-map",
    label: "Mapping Janji",
    mobileLabel: "Peta Janji",
    icon: CalendarDays,
  },
  { href: "/mapping", label: "Mapping", icon: MapPinned },
  { href: "/notifications", label: "Notifikasi", icon: Bell },
  {
    href: "/notification-settings",
    label: "Pengaturan Notifikasi",
    mobileLabel: "Pengaturan",
    icon: SlidersHorizontal,
  },
];

export function AppNav({
  isAdmin,
  canViewQrisRegistrations,
  roleLabel,
  scopeLabel,
  mobileOnly = false,
}: {
  isAdmin: boolean;
  canViewQrisRegistrations: boolean;
  roleLabel: string;
  scopeLabel: string;
  mobileOnly?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navItems = [
    ...items,
    ...(canViewQrisRegistrations
      ? [
          {
            href: "/qris-registrations",
            label: "Pendaftar QRIS",
            mobileLabel: "Pendaftar",
            icon: QrCode,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            href: "/admin",
            label: "Manajemen Pengguna",
            mobileLabel: "Akun",
            icon: Users,
          },
        ]
      : []),
  ];
  const signOut = async () => {
    if (
      !(await confirm({
        title: "Keluar dari MABES LINK?",
        description:
          "Sesi pada perangkat ini akan diakhiri. Pastikan perubahan pekerjaan sudah disimpan.",
        confirmLabel: "Ya, keluar",
        tone: "danger",
      }))
    )
      return;
    setBusy(true);
    try {
      await authClient.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      toast("Sesi belum dapat diakhiri. Coba lagi.", "error");
      setBusy(false);
    }
  };
  const links = navItems.map(({ href, label, mobileLabel, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setMoreOpen(false)}
        className={cn(
          mobileOnly
            ? "flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-semibold"
            : "relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition",
          active
            ? mobileOnly
              ? "bg-blue-50 text-blue-900"
              : "bg-white/10 text-white before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-full before:bg-amber-400"
            : mobileOnly
              ? "text-slate-500 hover:bg-slate-50"
              : "text-blue-100/85 hover:bg-white/8 hover:text-white",
        )}
      >
        <Icon size={mobileOnly ? 20 : 18} />
        <span>{mobileOnly ? (mobileLabel ?? label) : label}</span>
      </Link>
    );
  });
  if (mobileOnly)
    return (
      <>
        <nav
          className="fixed inset-x-0 bottom-0 z-[1200] grid h-[calc(72px+env(safe-area-inset-bottom))] grid-cols-5 items-start gap-1 border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,.06)] backdrop-blur lg:hidden"
          aria-label="Navigasi seluler"
        >
          {links.filter((link) =>
            ["/dashboard", "/work", "/mapping", "/notifications"].includes(
              String(link.key),
            ),
          )}
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-semibold text-slate-500 hover:bg-blue-50 hover:text-blue-800"
          >
            <Menu size={20} />
            <span>Lainnya</span>
          </button>
        </nav>
        <Dialog
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          title="Menu kerja"
          description={`${roleLabel} · ${scopeLabel}`}
          className="max-w-md"
        >
          <div className="grid grid-cols-2 gap-2">{links}</div>
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              void signOut();
            }}
            disabled={busy}
            className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <LogOut size={18} />
            {busy ? "Keluar…" : "Keluar"}
          </button>
        </Dialog>
      </>
    );
  return (
    <>
      <div className="mx-3 mt-3 hidden rounded-xl border border-white/10 bg-white/5 p-3 lg:block">
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-blue-200">
          Akses aktif
        </p>
        <p className="mt-1 text-sm font-black text-white">{roleLabel}</p>
        <p className="mt-1 text-xs leading-5 text-blue-100">{scopeLabel}</p>
      </div>
      <nav
        className="hidden flex-1 space-y-1 p-3 lg:block"
        aria-label="Navigasi utama"
      >
        {links}
      </nav>
      <button
        onClick={signOut}
        disabled={busy}
        className="mx-3 mb-4 hidden items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-100 transition hover:bg-white/8 hover:text-white lg:flex"
      >
        <LogOut size={18} />
        {busy ? "Keluar…" : "Keluar"}
      </button>
    </>
  );
}
