import {
  Mic,
  BookOpen,
  MousePointerClick,
  Languages,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  blurb: string;
}

const FEATURES: Feature[] = [
  {
    icon: Mic,
    title: "Live AI narration",
    blurb:
      "Natural-voice walkthroughs of any website. The AI speaks, the audience listens, anyone interrupts.",
  },
  {
    icon: BookOpen,
    title: "Knowledge-base grounding",
    blurb:
      "Upload PDFs, DOCX, .txt, .md. The AI cites your facts during prep and live Q&A — no hallucinations.",
  },
  {
    icon: MousePointerClick,
    title: "Drives real browsers",
    blurb:
      "Stagehand-powered: clicks, types, navigates exactly like a human presenter on the live product.",
  },
  {
    icon: Languages,
    title: "Multi-language",
    blurb:
      "English, Tagalog, and Bisaya out of the box. Pick a demo language; narration and Q&A follow.",
  },
];

export function FeatureGrid() {
  return (
    <section
      id="features"
      className="relative w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32 py-24 lg:py-32"
    >
      <header className="max-w-3xl mb-14 lg:mb-20 space-y-4">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.34em] text-secondary">
          02 // Capabilities
        </p>
        <h2 className="font-display font-bold leading-[1] tracking-tight text-[clamp(2.25rem,4.6vw,4.5rem)]">
          Everything a great <br className="hidden sm:block" />
          live demo needs.
        </h2>
        <p className="text-muted-foreground text-base lg:text-lg max-w-2xl leading-relaxed">
          Four jobs, one AI. Skip the slides; let an autonomous narrator drive
          the actual product while you handle the room.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-px bg-border/40 landing-hairline border rounded-2xl overflow-hidden">
        {FEATURES.map(({ icon: Icon, title, blurb }, i) => (
          <article
            key={title}
            className="landing-bracket-card relative bg-card hover:bg-card/80 transition-colors p-7 lg:p-9 min-h-[18rem] flex flex-col"
          >
            <div className="flex items-start justify-between mb-8">
              <div
                className="inline-flex items-center justify-center w-11 h-11 rounded-md border landing-hairline"
                style={{
                  background:
                    "radial-gradient(closest-side, hsl(199 75% 53% / 0.18), transparent)",
                }}
              >
                <Icon className="h-5 w-5 text-secondary" />
              </div>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground">
                {String(i + 1).padStart(2, "0")} / 04
              </span>
            </div>
            <h3 className="font-display text-2xl font-bold tracking-tight mb-3">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {blurb}
            </p>
            <div className="mt-auto pt-8">
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-secondary/80">
                ──── Live in v1
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
