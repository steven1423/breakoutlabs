"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that counts to its new value when it changes (CLAUDE.md §14: motion in response to actions).
 * Under prefers-reduced-motion it just shows the value.
 */
export function CountUp({ value, format, duration = 500 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = shownRef.current;
    if (reduced || start === value) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + (value - start) * eased;
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else shownRef.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span>{format(shown)}</span>;
}
