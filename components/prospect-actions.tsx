"use client";
import { OpportunityStage } from "@prisma/client";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";

export function ConfirmNeedButton({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    if (!window.confirm("Konfirmasi bahwa kebutuhan sudah dibahas dengan PIC?"))
      return;
    setBusy(true);
    try {
      await clientApi(`/api/prospects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version,
          opportunityStage: OpportunityStage.NEED_CONFIRMED,
        }),
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memperbarui.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button onClick={run} disabled={busy}>
        <CheckCircle2 size={16} />
        {busy ? "Menyimpan…" : "Konfirmasi kebutuhan"}
      </Button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
