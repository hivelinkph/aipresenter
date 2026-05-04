import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { MarqueeTicker } from "@/components/landing/MarqueeTicker";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { ClosingCta } from "@/components/landing/ClosingCta";

export default async function RootPage() {
  const user = await getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <LandingNav />
      <main className="flex-1 w-full">
        <Hero />
        <MarqueeTicker />
        <FeatureGrid />
        <ClosingCta />
      </main>
      <footer className="w-full border-t landing-hairline">
        <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32 h-14 flex items-center justify-between font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground">
          <span>© Presenter — Built for live product demos</span>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="/login" className="hover:text-foreground">
              Sign in
            </a>
            <a href="/signup" className="text-secondary hover:underline">
              Sign up →
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
