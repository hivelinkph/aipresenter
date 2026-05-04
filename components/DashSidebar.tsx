"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { LayoutGrid, SlidersHorizontal, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

// Knowledge base used to be a sibling tab; now it lives inline on each
// demo page (one KB per demo) so we no longer need a top-level entry.
const NAV = [
  { href: "/dashboard", label: "Demos", icon: LayoutGrid, exact: true },
  { href: "/dashboard/settings", label: "Settings", icon: SlidersHorizontal },
];

export function DashSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  function isActive(href: string, exact?: boolean): boolean {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <aside className="w-60 border-r border-border bg-card flex flex-col">
      <div className="p-5 border-b border-border">
        <div className="text-xs uppercase tracking-[0.2em] text-secondary">
          Presenter
        </div>
        <div className="text-sm font-semibold mt-1 truncate" title={email ?? ""}>
          {email ?? "—"}
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              isActive(href, exact)
                ? "bg-secondary/20 text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </aside>
  );
}
