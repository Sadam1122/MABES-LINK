"use client";
import { FollowUpStatus } from "@prisma/client";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";
export function CompleteFollowUp({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!confirm("Tandai tindak lanjut ini selesai?")) return;
    setBusy(true);
    try {
      await clientApi(`/api/follow-ups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ version, status: FollowUpStatus.COMPLETED }),
      });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal memperbarui.");
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
