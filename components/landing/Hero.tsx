import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroImg from "@/Assets/Photos/heroimage.png";

export function Hero() {
  return (
    <section className="relative w-full overflow-hidden landing-grid-bg">
      {/* Ambient sky-blue / navy radial glows. Sized to viewport, no clipping. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-72 right-[-20%] w-[1100px] h-[1100px] rounded-full opacity-[0.28] blur-[120px]"
        style={{
          background:
            "radial-gradient(closest-side, hsl(199 75% 53% / 0.7), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-72 left-[-15%] w-[900px] h-[900px] rounded-full opacity-[0.22] blur-[120px]"
        style={{
          background:
            "radial-gradient(closest-side, hsl(202 65% 19% / 0.95), transparent 70%)",
        }}
      />
      {/* Vertical hairline rule on the right of the content column on big screens */}
      <div
        aria-hidden
        className="hidden xl:block absolute top-0 bottom-0 left-1/2 w-px landing-hairline border-l"
      />

      <div className="relative w-full pl-6 pr-0 sm:pl-10 lg:pl-16 xl:pl-24 2xl:pl-32 pt-14 lg:pt-24 pb-24 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-10 xl:gap-16 items-center">
          {/* LEFT — content. Animation rises in on load with staggered delays. */}
          <div className="space-y-7 pr-6 sm:pr-10 lg:pr-0">
            <p
              className="landing-rise font-mono text-[0.72rem] uppercase tracking-[0.34em] text-secondary"
              style={{ animationDelay: "0ms" }}
            >
              <span aria-hidden className="text-secondary/60">
                ▍
              </span>{" "}
              01 // Presenter OS — Live AI demo driver
            </p>

            <h1
              className="landing-rise font-display font-bold leading-[0.95] tracking-tight text-[clamp(3rem,7.2vw,7.5rem)]"
              style={{ animationDelay: "80ms" }}
            >
              <span className="block">Present</span>
              <span className="block">anything.</span>
              <span className="relative inline-flex items-baseline">
                <span
                  className="text-secondary"
                  style={{
                    textShadow:
                      "0 0 24px hsl(199 75% 53% / 0.45), 0 0 60px hsl(199 75% 53% / 0.25)",
                  }}
                >
                  Automatically
                </span>
                <span
                  aria-hidden
                  className="landing-caret ml-1 inline-block w-[0.55ch] h-[0.85em] translate-y-[0.06em] bg-secondary"
                />
              </span>
            </h1>

            <p
              className="landing-rise text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl leading-relaxed"
              style={{ animationDelay: "180ms" }}
            >
              The AI presentation partner that walks any audience through any
              website — narrating, clicking, and answering live questions in
              English, Tagalog, or Bisaya. Grounded in <em>your</em> docs, not
              guesswork.
            </p>

            <div
              className="landing-rise flex flex-wrap items-center gap-3 pt-2"
              style={{ animationDelay: "260ms" }}
            >
              <Button
                size="lg"
                variant="secondary"
                asChild
                className="landing-cta-glow font-mono text-xs uppercase tracking-[0.18em] h-12 px-7"
              >
                <Link href="/signup">
                  Get started free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                asChild
                className="font-mono text-xs uppercase tracking-[0.18em] h-12"
              >
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>

            {/* Stat strip — control-panel readout. */}
            <div
              className="landing-rise grid grid-cols-3 gap-4 max-w-2xl pt-6 border-t landing-hairline"
              style={{ animationDelay: "340ms" }}
            >
              <Stat label="Languages" value="03" sub="EN / TL / CEB" />
              <Stat label="RAG sources" value="∞" sub="PDF · DOCX · MD" />
              <Stat label="Browser" value="LIVE" sub="Stagehand-driven" />
            </div>
          </div>

          {/* RIGHT — hero image, fills the right half of the viewport from
              center to the far right edge of the page on desktop. */}
          <div
            className="landing-rise relative pr-6 sm:pr-10 lg:pr-0"
            style={{ animationDelay: "120ms" }}
          >
            <div
              className="
                relative aspect-[16/10] w-full
                rounded-2xl lg:rounded-l-2xl lg:rounded-r-none
                overflow-hidden border landing-hairline
                shadow-[0_30px_120px_-20px_rgba(44,169,225,0.45)]
              "
              style={{
                background:
                  "radial-gradient(ellipse at center, hsl(202 65% 19% / 0.45) 0%, hsl(228 45% 4%) 75%)",
              }}
            >
              <Image
                src={heroImg}
                alt="AI Presenter overview — six source-type cards (PDFs, Pictures, Google Slides, PowerPoint, Websites, Apps) with a 3D AI host"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain"
              />
              {/* Floating control-panel caption */}
              <div className="absolute top-4 left-4 z-10 inline-flex items-center gap-2 rounded-md border landing-hairline bg-background/70 backdrop-blur px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-secondary">
                <span
                  aria-hidden
                  className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"
                />
                Live narration · 00:42
              </div>
              <div className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-2 rounded-md border landing-hairline bg-background/70 backdrop-blur px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground">
                Powered by Gemini Live
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-3xl font-bold leading-none">
        {value}
      </div>
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-secondary/80">
        {sub}
      </div>
    </div>
  );
}
