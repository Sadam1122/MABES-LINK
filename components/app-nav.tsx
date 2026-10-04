"use client";

import {
  Bell,
  BriefcaseBusiness,
  LayoutDashboard,
  LogOut,
  MapPinned,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Beranda", icon: LayoutDashboard },
  { href: "/work", label: "Akuisisi Nasabah", mobileLabel: "Akuisisi", icon: BriefcaseBusiness },
  { href: "/mapping", label: "Mapping", icon: MapPinned },
  { href: "/notifications", label: "Notifikasi", icon: Bell },
  { href: "/notification-settings", label: "Pengaturan Notifikasi", mobileLabel: "Pengaturan", icon: SlidersHorizontal },
];

export function AppNav({
  isAdmin,
  roleLabel,
  scopeLabel,
  mobileOnly = false,
}: {
  isAdmin: boolean;
  roleLabel: string;
  scopeLabel: string;
  mobileOnly?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const navItems = isAdmin
    ? [...items, { href: "/admin", label: "Manajemen Pengguna", mobileLabel: "Akun", icon: Users }]
    : items;
  const signOut = async () => {
    setBusy(true);
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  };
  const links = navItems.map(({ href, label, mobileLabel, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          mobileOnly
            ? "flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[10px] font-bold"
            : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
          active
            ? mobileOnly
              ? "text-blue-800"
              : "bg-white/12 text-white"
            : mobileOnly
              ? "text-slate-500"
              : "text-blue-100 hover:bg-white/8 hover:text-white",
        )}
      >
        <Icon size={mobileOnly ? 20 : 18} />
        <span>{mobileOnly ? (mobileLabel ?? label) : label}</span>
      </Link>
    );
  });
  if (mobileOnly)
    return (
      <nav
        className="fixed inset-x-0 bottom-0 z-[1200] flex h-[72px] items-start gap-1 overflow-x-auto border-t bg-white px-2 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,.08)] lg:hidden"
        aria-label="Navigasi seluler"
      >
        <div className="flex min-w-max flex-1 justify-around gap-1">{links}</div>
      </nav>
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
