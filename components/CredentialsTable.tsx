"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCredentials } from "@/lib/credentials";
import { useSession } from "@/lib/session";
import { Eye, EyeOff, Trash2 } from "lucide-react";

export function CredentialsTable() {
  const roles = useCredentials((s) => s.roles);
  const upsert = useCredentials((s) => s.upsert);
  const remove = useCredentials((s) => s.remove);
  const state = useSession((s) => s.state);

  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState<string | null>(null);

  const locked = state === "running" || state === "paused" || state === "starting";

  function addRow() {
    if (!role || !username || !password) return;
    upsert({ role, username, password });
    setRole("");
    setUsername("");
    setPassword("");
  }

  return (
    <div className="space-y-3">
      <Label>Credentials (in-memory only; never sent to Gemini)</Label>

      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
        <Input
          placeholder="Role (e.g. admin)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={locked}
        />
        <Input
          placeholder="Username / email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={locked}
        />
        <Input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={locked}
        />
        <Button onClick={addRow} disabled={locked || !role || !username || !password}>
          Add
        </Button>
      </div>

      {roles.length > 0 && (
        <div className="rounded-md border divide-y">
          {roles.map((r) => (
            <div
              key={r.role}
              className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center px-3 py-2 text-sm"
            >
              <div className="font-medium">{r.role}</div>
              <div className="text-muted-foreground">{r.username}</div>
              <div className="font-mono">
                {reveal === r.role ? r.password : "•".repeat(Math.min(r.password.length, 10))}
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setReveal(reveal === r.role ? null : r.role)}
                aria-label="Toggle password visibility"
              >
                {reveal === r.role ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove(r.role)}
                disabled={locked}
                aria-label="Remove role"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
