"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: signup, error: signupErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || null } },
    });
    if (signupErr) {
      setError(signupErr.message);
      setLoading(false);
      return;
    }

    // If email confirmation is on there's no session yet — sign in immediately.
    if (!signup.session) {
      const { error: siErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (siErr) {
        setError(
          `Account created, but sign-in failed: ${siErr.message}. ` +
            `Disable email confirmations in Supabase Auth settings.`,
        );
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    router.replace("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>
            Sign up to save demos and upload knowledge bases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="(optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating account…" : "Create account"}
            </Button>
            <div className="text-xs text-muted-foreground text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-secondary hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
