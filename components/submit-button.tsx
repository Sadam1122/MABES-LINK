"use client";
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
export function SubmitButton({
  busy,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy: boolean }) {
  return (
    <Button type="submit" disabled={busy || props.disabled} {...props}>
      {busy ? <LoaderCircle className="animate-spin" size={16} /> : null}
      {busy ? "Menyimpan…" : children}
    </Button>
  );
}
