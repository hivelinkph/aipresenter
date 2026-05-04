import { create } from "zustand";

export interface RoleCredential {
  role: string;
  username: string;
  password: string;
}

interface CredentialsStore {
  roles: RoleCredential[];
  upsert: (role: RoleCredential) => void;
  remove: (role: string) => void;
  clear: () => void;
  /**
   * Hydrate from saved role names. Always returns blank passwords —
   * passwords MUST never be persisted, so the user re-enters them each
   * session. Existing entries are kept if they already have credentials.
   */
  hydrateNames: (names: string[]) => void;
  listNames: () => string[];
  resolve: (role: string) => RoleCredential | undefined;
}

export const useCredentials = create<CredentialsStore>((set, get) => ({
  roles: [],
  upsert: (role) =>
    set((prev) => {
      const existing = prev.roles.findIndex(
        (r) => r.role.toLowerCase() === role.role.toLowerCase(),
      );
      if (existing >= 0) {
        const next = [...prev.roles];
        next[existing] = role;
        return { roles: next };
      }
      return { roles: [...prev.roles, role] };
    }),
  remove: (role) =>
    set((prev) => ({
      roles: prev.roles.filter((r) => r.role.toLowerCase() !== role.toLowerCase()),
    })),
  clear: () => set({ roles: [] }),
  hydrateNames: (names) =>
    set((prev) => {
      const existing = new Map(
        prev.roles.map((r) => [r.role.toLowerCase(), r]),
      );
      const next: RoleCredential[] = names.map((name) => {
        const found = existing.get(name.toLowerCase());
        if (found) return found;
        return { role: name, username: "", password: "" };
      });
      return { roles: next };
    }),
  listNames: () => get().roles.map((r) => r.role),
  resolve: (role) =>
    get().roles.find((r) => r.role.toLowerCase() === role.toLowerCase()),
}));

// Redaction helper used before any transcript/system entry that might have received
// raw text from a user-adjacent surface.
export function redactCredentials(text: string, roles: RoleCredential[]): string {
  if (!text) return text;
  let out = text;
  for (const r of roles) {
    if (r.password && r.password.length >= 3) {
      out = out.split(r.password).join("••••••");
    }
  }
  return out;
}
