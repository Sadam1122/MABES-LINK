"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { clientApi } from "@/lib/client-api";

export function ServiceCaseDeleteButton({
  id,
  version,
  redirectAfter = false,
}: {
  id: string;
  version: number;
  redirectAfter?: boolean;
}) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (
      !(await confirm({
        title: "Hapus kartu akuisisi?",
        description:
          "Kartu akan disembunyikan dari daftar, status janji dibatalkan, dan seluruh reminder aktif dihentikan. Riwayat audit tetap disimpan.",
        confirmLabel: "Hapus kartu",
        tone: "danger",
      }))
    )
      return;
    setBusy(true);
    try {
      await clientApi(`/api/service-cases/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ version }),
      });
      toast("Kartu akuisisi dihapus dari daftar operasional.", "success");
      if (redirectAfter) router.replace("/work");
      else router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Kartu gagal dihapus.", "error");
      setBusy(false);
    }
  };

  return (
    <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => void remove()}>
      <Trash2 size={15} /> {busy ? "Menghapus…" : "Hapus"}
    </Button>
  );
}
