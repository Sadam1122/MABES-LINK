"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { clientApi } from "@/lib/client-api";

const HandoverStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  ACCEPTED: "ACCEPTED",
  PROCESSING: "PROCESSING",
  ON_HOLD: "ON_HOLD",
  ESCALATED: "ESCALATED",
  READY: "READY",
} as const;
type HandoverStatus = (typeof HandoverStatus)[keyof typeof HandoverStatus];

const Role = {
  OUT_BRANCH: "OUT_BRANCH",
  CS: "CS",
  SUPERVISOR: "SUPERVISOR",
  ADMIN: "ADMIN",
} as const;
type Role = (typeof Role)[keyof typeof Role];

const next: Record<
  string,
  { status: HandoverStatus; label: string; confirm: string }[]
> = {
  DRAFT: [
    {
      status: HandoverStatus.SUBMITTED,
      label: "Kirim ke CS",
      confirm:
        "Kirim handover ke CS penerima? Setelah dikirim, isi batch tidak dapat diubah.",
    },
  ],
  SUBMITTED: [
    {
      status: HandoverStatus.ACCEPTED,
      label: "Terima handover",
      confirm: "Akui bahwa handover ini telah diterima?",
    },
  ],
  ACCEPTED: [
    {
      status: HandoverStatus.PROCESSING,
      label: "Mulai diproses",
      confirm: "Mulai proses onboarding?",
    },
    {
      status: HandoverStatus.ON_HOLD,
      label: "Tandai tertahan",
      confirm:
        "Tandai batch tertahan? Pastikan subkasus kendala nyata sudah dicatat.",
    },
    {
      status: HandoverStatus.ESCALATED,
      label: "Eskalasi",
      confirm: "Eskalasi batch ini?",
    },
  ],
  PROCESSING: [
    {
      status: HandoverStatus.READY,
      label: "Tandai siap",
      confirm:
        "Konfirmasi layanan selesai onboarding dan siap digunakan? Ini tidak mencatat penggunaan.",
    },
    {
      status: HandoverStatus.ON_HOLD,
      label: "Tertahan",
      confirm: "Tandai batch tertahan?",
    },
    {
      status: HandoverStatus.ESCALATED,
      label: "Eskalasi",
      confirm: "Eskalasi batch ini?",
    },
  ],
  ON_HOLD: [
    {
      status: HandoverStatus.PROCESSING,
      label: "Lanjutkan proses",
      confirm: "Lanjutkan proses batch?",
    },
    {
      status: HandoverStatus.ESCALATED,
      label: "Eskalasi",
      confirm: "Eskalasi batch ini?",
    },
  ],
  ESCALATED: [
    {
      status: HandoverStatus.PROCESSING,
      label: "Kembali diproses",
      confirm: "Kembalikan batch ke proses?",
    },
    {
      status: HandoverStatus.ON_HOLD,
      label: "Tertahan",
      confirm: "Tandai batch tertahan?",
    },
  ],
};

export function HandoverActions({
  id,
  version,
  status,
  role,
}: {
  id: string;
  version: number;
  status: HandoverStatus;
  role: Role;
}) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [busy, setBusy] = useState("");
  const allowed = (next[status] ?? []).filter(() =>
    status === HandoverStatus.DRAFT
      ? ([Role.OUT_BRANCH, Role.SUPERVISOR, Role.ADMIN] as Role[]).includes(
          role,
        )
      : ([Role.CS, Role.SUPERVISOR, Role.ADMIN] as Role[]).includes(role),
  );
  async function run(item: (typeof allowed)[number]) {
    if (!(await confirm({ title: item.label, description: item.confirm, confirmLabel: item.label }))) return;
    setBusy(item.status);
    try {
      await clientApi(`/api/handovers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ version, status: item.status }),
      });
      router.refresh();
      toast("Status handover berhasil diperbarui.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal memperbarui.", "error");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {allowed.map((item) => (
        <Button
          key={item.status}
          onClick={() => run(item)}
          disabled={Boolean(busy)}
          variant={
            item.status === HandoverStatus.READY ||
            item.status === HandoverStatus.ACCEPTED
              ? "default"
              : "outline"
          }
        >
          {busy === item.status ? "Menyimpan…" : item.label}
        </Button>
      ))}
    </div>
  );
}
