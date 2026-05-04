import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-background/55 border-b landing-hairline">
      <nav className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32 h-16 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 font-display text-base font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="inline-block w-2 h-2 rounded-full bg-secondary shadow-[0_0_12px_hsl(199_75%_53%/0.9)]"
          />
          <span className="uppercase tracking-[0.18em] text-[0.78rem] text-muted-foreground">
            Presenter
          </span>
          <span className="font-mono text-[0.65rem] text-secondary/70 ml-1 hidden sm:inline">
            v1.0
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">
            // Features
          </a>
          <a href="#how" className="hover:text-foreground transition-colors">
            // How it works
          </a>
          <a href="#cta" className="hover:text-foreground transition-colors">
            // Get started
          </a>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login" className="font-mono text-xs uppercase tracking-[0.18em]">
              Sign in
            </Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link
              href="/signup"
              className="font-mono text-xs uppercase tracking-[0.18em]"
            >
              Sign up →
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
