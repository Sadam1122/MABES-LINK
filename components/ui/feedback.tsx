"use client";

import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ToastTone = "success" | "error" | "info";
type ConfirmOptions = { title: string; description: string; confirmLabel?: string; tone?: "default" | "danger" };
type FeedbackValue = { toast: (message: string, tone?: ToastTone) => void; confirm: (options: ConfirmOptions) => Promise<boolean> };
const FeedbackContext = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: ToastTone }[]>([]);
  const [question, setQuestion] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((old) => [...old, { id, message, tone }].slice(-4));
    window.setTimeout(() => setToasts((old) => old.filter((item) => item.id !== id)), 4_500);
  }, []);
  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false);
    setQuestion(options);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);
  const answer = (value: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setQuestion(null);
    resolve?.(value);
  };
  const value = useMemo(() => ({ toast, confirm }), [confirm, toast]);
  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 top-3 z-[7000] flex flex-col items-end gap-2 sm:left-auto sm:right-5 sm:top-5 sm:w-[380px]" aria-live="polite" aria-atomic="true">
        {toasts.map((item) => {
          const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "error" ? CircleAlert : Info;
          return <div key={item.id} role={item.tone === "error" ? "alert" : "status"} className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border bg-white p-4 shadow-xl">
            <Icon size={20} className={item.tone === "success" ? "text-emerald-600" : item.tone === "error" ? "text-red-600" : "text-blue-700"} />
            <p className="flex-1 text-sm font-semibold text-slate-800">{item.message}</p>
            <button type="button" aria-label="Tutup pesan" className="grid size-8 place-items-center rounded-lg hover:bg-slate-100" onClick={() => setToasts((old) => old.filter((row) => row.id !== item.id))}><X size={16} /></button>
          </div>;
        })}
      </div>
      <Dialog open={Boolean(question)} onClose={() => answer(false)} title={question?.title ?? "Konfirmasi"} description={question?.description} className="max-w-md" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => answer(false)}>Batal</Button><Button variant={question?.tone === "danger" ? "danger" : "default"} onClick={() => answer(true)} data-autofocus>{question?.confirmLabel ?? "Konfirmasi"}</Button></div>}>
        <p className="text-sm text-slate-600">Tindakan hanya dijalankan setelah Anda mengonfirmasi.</p>
      </Dialog>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("useFeedback harus digunakan di dalam FeedbackProvider.");
  return value;
}
