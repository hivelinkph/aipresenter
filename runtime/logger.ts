const SENSITIVE_KEYS = /^(password|pass|pwd|secret|token|apikey|api_key)$/i;

export function redactInObject<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redactInObject(v)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(k)) out[k] = "••••••";
    else out[k] = redactInObject(v);
  }
  return out as T;
}

export const log = {
  info: (msg: string, meta?: unknown) => {
    if (meta !== undefined) {
      console.log(`[agent] ${msg}`, redactInObject(meta));
    } else {
      console.log(`[agent] ${msg}`);
    }
  },
  warn: (msg: string, meta?: unknown) => {
    if (meta !== undefined) console.warn(`[agent] ${msg}`, redactInObject(meta));
    else console.warn(`[agent] ${msg}`);
  },
  error: (msg: string, meta?: unknown) => {
    if (meta !== undefined) console.error(`[agent] ${msg}`, redactInObject(meta));
    else console.error(`[agent] ${msg}`);
  },
};
