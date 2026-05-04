"use client";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";

function fmt(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function DurationTimer() {
  const startedAt = useSession((s) => s.startedAt);
  const endedAt = useSession((s) => s.endedAt);
  const state = useSession((s) => s.state);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || endedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt, endedAt]);

  if (!startedAt && state !== "ended") {
    return (
      <div
        className="font-mono text-2xl tabular-nums tracking-wider"
        style={{ color: "#86efac" }}
        aria-label="Demo duration"
      >
        00:00
      </div>
    );
  }

  const elapsed = (endedAt ?? now) - (startedAt ?? now);
  return (
    <div
      className="font-mono text-2xl tabular-nums tracking-wider"
      style={{ color: "#86efac" }}
      aria-label="Demo duration"
    >
      {fmt(elapsed)}
    </div>
  );
}
