"use client";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/session";
import { formatDuration } from "@/lib/utils";
import { useEffect, useState } from "react";

export function StatusBar() {
  const state = useSession((s) => s.state);
  const connections = useSession((s) => s.connections);
  const startedAt = useSession((s) => s.startedAt);
  const endedAt = useSession((s) => s.endedAt);
  const lastError = useSession((s) => s.lastError);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (state === "running" || state === "paused") {
      const id = window.setInterval(() => setNow(Date.now()), 1000);
      return () => window.clearInterval(id);
    }
  }, [state]);

  const elapsed =
    startedAt !== null ? (endedAt ?? now) - startedAt : 0;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <StatePill state={state} />
      <Badge variant={connections.gemini === "connected" ? "success" : "outline"}>
        Gemini · {connections.gemini}
      </Badge>
      <Badge variant={connections.agent === "connected" ? "success" : "outline"}>
        Agent · {connections.agent}
      </Badge>
      <Badge variant={connections.browser === "ready" ? "success" : "outline"}>
        Browser · {connections.browser}
      </Badge>
      {startedAt !== null && (
        <span className="text-muted-foreground">⏱ {formatDuration(elapsed)}</span>
      )}
      {lastError && (
        <Badge variant="destructive">⚠ {lastError}</Badge>
      )}
    </div>
  );
}

function StatePill({ state }: { state: string }) {
  const variant =
    state === "running"
      ? "success"
      : state === "paused"
      ? "warning"
      : state === "ended"
      ? "secondary"
      : "outline";
  return (
    <Badge variant={variant as any} className="uppercase tracking-wide">
      {state}
    </Badge>
  );
}
