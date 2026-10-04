"use client";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { clientApi } from "@/lib/client-api";

export function ConfirmNeedButton({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    if (!(await confirm({ title: "Konfirmasi kebutuhan?", description: "Pastikan kebutuhan sudah dibahas dengan PIC sebelum mengubah tahap peluang.", confirmLabel: "Konfirmasi" }))) return;
    setBusy(true);
    try {
      await clientApi(`/api/prospects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version,
          opportunityStage: "NEED_CONFIRMED",
        }),
      });
      router.refresh();
      toast("Kebutuhan berhasil dikonfirmasi.", "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal memperbarui.";
      setError(message);
      toast(message, "error");
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
