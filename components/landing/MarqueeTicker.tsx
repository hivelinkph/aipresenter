const TAGS = [
  "LIVE NARRATION",
  "PDF · DOCX · MD GROUNDING",
  "REAL BROWSERS",
  "TAGALOG",
  "BISAYA",
  "ENGLISH",
  "REAL-TIME Q&A",
  "VECTOR SEARCH",
  "STAGEHAND-DRIVEN",
  "GEMINI LIVE",
  "MULTI-TENANT",
  "OWN YOUR DATA",
];

function TagRow() {
  return (
    <div className="flex items-center gap-12 px-6 shrink-0">
      {TAGS.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-3 font-mono text-[0.78rem] uppercase tracking-[0.28em] text-muted-foreground whitespace-nowrap"
        >
          <span aria-hidden className="text-secondary text-[0.7rem]">
            ◆
          </span>
          {tag}
        </span>
      ))}
    </div>
  );
}

export function MarqueeTicker() {
  return (
    <section
      aria-label="Capabilities"
      className="relative w-full border-y landing-hairline bg-card/40 overflow-hidden"
    >
      {/* fade masks so the marquee bleeds in/out at the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-32 z-10"
        style={{
          background:
            "linear-gradient(to right, hsl(228 45% 4%) 0%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10"
        style={{
          background:
            "linear-gradient(to left, hsl(228 45% 4%) 0%, transparent 100%)",
        }}
      />
      <div className="flex landing-marquee-track py-5 will-change-transform">
        {/* Two duplicates back-to-back so translate(-50%) loops seamlessly. */}
        <TagRow />
        <TagRow />
      </div>
    </section>
  );
}
