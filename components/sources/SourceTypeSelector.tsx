"use client";
import { useSession } from "@/lib/session";
import {
  SOURCE_LABELS,
  SOURCE_ORDER,
  LIVE_RUNTIME_SOURCES,
  type SourceType,
} from "@/lib/sources";
import {
  FileText,
  Image as ImageIcon,
  Presentation,
  FileSpreadsheet,
  Globe,
  AppWindow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<SourceType, LucideIcon> = {
  pdfs: FileText,
  pictures: ImageIcon,
  googleSlides: Presentation,
  powerPoint: FileSpreadsheet,
  websites: Globe,
  apps: AppWindow,
};

export function SourceTypeSelector() {
  const sourceTypes = useSession((s) => s.sourceTypes);
  const toggleSourceType = useSession((s) => s.toggleSourceType);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {SOURCE_ORDER.map((type) => {
        const Icon = ICONS[type];
        const enabled = sourceTypes.includes(type);
        const isLive = LIVE_RUNTIME_SOURCES.includes(type);
        return (
          <label
            key={type}
            className={
              "flex items-center gap-2 cursor-pointer select-none rounded-md border p-3 transition-colors " +
              (enabled
                ? "border-secondary bg-secondary/10"
                : "border-input bg-background hover:bg-muted")
            }
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => toggleSourceType(type, e.target.checked)}
              className="h-4 w-4 accent-secondary cursor-pointer"
            />
            <Icon className="h-4 w-4 text-secondary shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium leading-none truncate">
                {SOURCE_LABELS[type]}
              </div>
              {!isLive && (
                <div className="mt-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                  Config only
                </div>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
