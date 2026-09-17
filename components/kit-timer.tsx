"use client";

import { useEffect, useState } from "react";

type Props = { enteredAt: string; slaHours: number | null };

function format(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/** Live clock for the current state: time in state, and time over the SLA once it is passed. Ticks each minute. */
export function KitTimer({ enteredAt, slaHours }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - Date.parse(enteredAt);
  const over = slaHours === null ? 0 : elapsed - slaHours * 3_600_000;
  const stuck = over > 0;
  return (
    <p className="text-15" aria-live="polite">
      <span className="text-muted">In state for </span>
      <span className={stuck ? "text-accent" : ""}>{format(elapsed)}</span>
      {slaHours === null ? (
        <span className="text-muted">. No SLA for this state.</span>
      ) : stuck ? (
        <span className="text-accent">, {format(over)} past the {slaHours}h SLA.</span>
      ) : (
        <span className="text-muted">, {format(-over)} left of the {slaHours}h SLA.</span>
      )}
    </p>
  );
}
