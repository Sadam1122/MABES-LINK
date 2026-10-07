"use client";

import { X } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const focusable =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  dirty?: boolean;
  busy?: boolean;
  className?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dirty = false,
  busy = false,
  className,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const discardReturnFocusRef = useRef<HTMLElement | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const shell = document.querySelector<HTMLElement>("#app-shell");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    shell?.setAttribute("inert", "");
    const timer = window.setTimeout(
      () =>
        panelRef.current
          ?.querySelector<HTMLElement>("[data-autofocus]," + focusable)
          ?.focus(),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      shell?.removeAttribute("inert");
      returnFocusRef.current?.focus();
      setConfirmDiscard(false);
    };
  }, [open]);
  useEffect(() => {
    if (confirmDiscard)
      panelRef.current
        ?.querySelector<HTMLElement>("[data-discard-autofocus]")
        ?.focus();
  }, [confirmDiscard]);

  const requestClose = () => {
    if (busy) return;
    if (dirty) {
      discardReturnFocusRef.current =
        document.activeElement as HTMLElement | null;
      setConfirmDiscard(true);
    } else onClose();
  };
  const cancelDiscard = () => {
    setConfirmDiscard(false);
    discardReturnFocusRef.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (confirmDiscard) {
        setConfirmDiscard(false);
        discardReturnFocusRef.current?.focus();
      } else if (!busy) {
        if (dirty) {
          discardReturnFocusRef.current =
            document.activeElement as HTMLElement | null;
          setConfirmDiscard(true);
        } else onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busy, confirmDiscard, dirty, onClose, open]);
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusRoot = confirmDiscard
      ? panelRef.current?.querySelector<HTMLElement>('[role="alertdialog"]')
      : panelRef.current;
    const nodes = Array.from(
      focusRoot?.querySelectorAll<HTMLElement>(focusable) ?? [],
    ).filter((node) => !node.hasAttribute("disabled"));
    if (!nodes.length) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (typeof document === "undefined" || !open) return null;
  return createPortal(
    <DialogCloseContext.Provider value={requestClose}>
      <div
        className="dialog-overlay fixed inset-0 z-[5000] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
        onMouseDown={(event) =>
          event.target === event.currentTarget && requestClose()
        }
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className={cn(
            "dialog-panel relative flex max-h-[min(92dvh,900px)] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl",
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
            <div>
              <h2
                id={titleId}
                className="text-lg font-black text-slate-950 sm:text-xl"
              >
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              aria-label={`Tutup ${title}`}
              className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 active:scale-95 disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-pt-28 scroll-pb-20 px-5 py-5 sm:px-6">
            {children}
          </div>
          {footer ? (
            <div className="shrink-0 border-t bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              {footer}
            </div>
          ) : null}
          {confirmDiscard ? (
            <div className="absolute inset-0 z-[6000] grid place-items-center bg-slate-950/45 p-4">
              <div
                role="alertdialog"
                aria-modal="true"
                aria-label="Buang perubahan"
                className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
              >
                <h3 className="text-lg font-black">Buang perubahan?</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Data yang belum disimpan akan hilang.
                </p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={cancelDiscard}
                    data-discard-autofocus
                  >
                    Lanjut mengisi
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setConfirmDiscard(false);
                      onClose();
                    }}
                  >
                    Buang perubahan
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </DialogCloseContext.Provider>,
    document.body,
  );
}

const DialogCloseContext = createContext<(() => void) | null>(null);

export function DialogClose({ onClick, ...props }: ButtonProps) {
  const close = useContext(DialogCloseContext);
  return (
    <Button
      type="button"
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) close?.();
      }}
    />
  );
}
