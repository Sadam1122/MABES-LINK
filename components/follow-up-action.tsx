"use client";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { clientApi } from "@/lib/client-api";
export function CompleteFollowUp({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!(await confirm({ title: "Selesaikan tindak lanjut?", description: "Reminder aktif untuk jadwal ini akan dibatalkan.", confirmLabel: "Tandai selesai" }))) return;
    setBusy(true);
    try {
      await clientApi(`/api/follow-ups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ version, status: "COMPLETED" }),
      });
      router.refresh();
      toast("Tindak lanjut ditandai selesai.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal memperbarui.", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={run} disabled={busy}>
      <Check size={14} />
      {busy ? "…" : "Selesai"}
    </Button>
  );
}
