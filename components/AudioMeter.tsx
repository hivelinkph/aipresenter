"use client";
import { cn } from "@/lib/utils";

interface Props {
  level: number; // 0..1
  muted: boolean;
}

export function AudioMeter({ level, muted }: Props) {
  const pct = Math.min(100, Math.round(level * 200));
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {muted ? "Mic muted" : "Mic live"}
      </span>
      <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-[width] duration-75",
            muted ? "bg-slate-400" : "bg-emerald-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
