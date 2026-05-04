import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function ClosingCta() {
  return (
    <section
      id="cta"
      className="relative w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32 py-28 lg:py-40 border-t landing-hairline overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] rounded-full opacity-[0.18] blur-[120px]"
        style={{
          background:
            "radial-gradient(closest-side, hsl(199 75% 53% / 0.7), transparent 70%)",
        }}
      />
      <div className="relative max-w-5xl">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.34em] text-secondary mb-6">
          03 // The pitch
        </p>
        <h2 className="font-display font-bold leading-[0.98] tracking-tight text-[clamp(2.5rem,6vw,6rem)] mb-6">
          Stop reading <br />
          <span className="text-muted-foreground line-through decoration-secondary/40 decoration-[6px]">
            slides aloud.
          </span>
        </h2>
        <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-10">
          Let an AI do it. Live. Grounded in your own knowledge base. In your
          audience&apos;s language. While you handle the room.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            variant="secondary"
            asChild
            className="landing-cta-glow font-mono text-xs uppercase tracking-[0.18em] h-12 px-8"
          >
            <Link href="/signup">
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="font-mono text-xs uppercase tracking-[0.18em] h-12"
          >
            <Link href="/login">Sign in</Link>
          </Button>
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground ml-2">
            ── No card. No setup wizard. Free during preview.
          </span>
        </div>
      </div>
    </section>
  );
}
