"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type SearchOption = { id: string; label: string; detail?: string };

/** Caller debounces its data/query, so typing never resets the field or its placeholder. */
export function SearchCombobox({
  label,
  placeholder,
  value,
  onChange,
  options,
  onSelect,
  loading = false,
  error = "",
  empty = "Tidak ditemukan. Coba kata lain.",
  minLength = 2,
  dropdownSide = "bottom",
  id: suppliedId,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  onSelect: (option: SearchOption) => void;
  loading?: boolean;
  error?: string;
  empty?: string;
  minLength?: number;
  dropdownSide?: "top" | "bottom";
  id?: string;
}) {
  const generated = useId();
  const id = suppliedId ?? `search-${generated}`;
  const listId = `${id}-options`;
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const shown = open && value.trim().length >= minLength;
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const choose = (option: SearchOption) => {
    onSelect(option);
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  };
  return (
    <div
      ref={root}
      className="relative min-w-0"
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-bold text-slate-700"
      >
        {label}
      </label>
      <div className="relative">
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          ref={input}
          id={id}
          role="combobox"
          type="text"
          autoComplete="off"
          spellCheck={false}
          className="field !pl-10 !pr-11"
          value={value}
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={
            shown && !loading && !error && options.length > 0
              ? listId
              : undefined
          }
          aria-activedescendant={
            shown && !loading && options[active]
              ? `${id}-option-${active}`
              : undefined
          }
          aria-describedby={
            shown && (loading || error || options.length === 0)
              ? `${id}-status`
              : undefined
          }
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && shown) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              return;
            }
            if (
              (event.key === "ArrowDown" || event.key === "ArrowUp") &&
              options.length &&
              !loading
            ) {
              event.preventDefault();
              setOpen(true);
              setActive((current) =>
                event.key === "ArrowDown"
                  ? (current + 1) % options.length
                  : (current - 1 + options.length) % options.length,
              );
            }
            if (event.key === "Enter" && shown) {
              // Searching must not accidentally submit the surrounding appointment form.
              event.preventDefault();
              if (options[active] && !loading) choose(options[active]);
            }
          }}
        />
        {loading ? (
          <LoaderCircle
            aria-label="Mencari"
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-700"
          />
        ) : (
          value && (
            <button
              type="button"
              aria-label={`Bersihkan ${label}`}
              className="absolute right-0 top-0 grid size-11 place-items-center rounded-xl text-slate-500 hover:text-blue-800"
              onClick={() => {
                onChange("");
                setActive(-1);
                input.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          )
        )}
      </div>
      {shown && (
        <div
          className={`absolute z-[1800] w-full rounded-xl border bg-white shadow-xl ${dropdownSide === "top" ? "bottom-full mb-2" : "mt-2"}`}
        >
          {loading || error || !options.length ? (
            <p
              id={`${id}-status`}
              role={error ? "alert" : "status"}
              className={`p-3 text-xs leading-5 ${error ? "text-red-700" : "text-slate-600"}`}
            >
              {loading ? "Mencari…" : error || empty}
            </p>
          ) : (
            <div
              id={listId}
              role="listbox"
              aria-label={`Saran ${label}`}
              className="max-h-64 overflow-y-auto overscroll-contain p-1"
            >
              {options.map((option, index) => (
                <div
                  key={option.id}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={active === index}
                  className={`cursor-pointer rounded-lg px-3 py-3 text-sm ${active === index ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50"}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <span className="block font-semibold">{option.label}</span>
                  {option.detail && (
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {option.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
