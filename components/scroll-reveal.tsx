"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export function ScrollReveal({ children, className = "", direction = "up", delay = 0 }: {
  children: ReactNode;
  className?: string;
  direction?: "up" | "left" | "right";
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Progressive enhancement: content is visible without JS, and content
    // already in view is never hidden during hydration.
    if (element.getBoundingClientRect().top < window.innerHeight * 0.94) return;
    element.dataset.revealPending = "true";
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      delete element.dataset.revealPending;
      observer.disconnect();
    }, { threshold: 0, rootMargin: "0px 0px -6% 0px" });
    observer.observe(element);
    return () => { observer.disconnect(); delete element.dataset.revealPending; };
  }, []);
  return <div ref={ref} data-reveal-direction={direction} className={`scroll-reveal ${className}`} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>{children}</div>;
}
