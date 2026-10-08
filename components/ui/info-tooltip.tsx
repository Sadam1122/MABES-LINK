"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/** Inline help: hover, focus, click/touch and Escape all work. No title-only help. */
export function InfoTooltip({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <span
      ref={root}
      className="relative inline-flex align-middle font-normal"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Informasi ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className="inline-grid size-8 place-items-center rounded-full text-slate-500 hover:bg-blue-50 hover:text-blue-800"
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!root.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        <Info size={16} aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-[6500] mt-1 w-[min(17rem,65vw)] rounded-xl border border-blue-100 bg-white p-3 text-left text-xs leading-5 text-slate-700 shadow-xl"
        >
          {children}
        </span>
      )}
    </span>
  );
}
