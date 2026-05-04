import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] admin client missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — only KB processing routes need this",
  );
}

/**
 * Service-role Supabase client. Bypasses RLS — only use from internal
 * server routes that have already verified the caller's identity (e.g. the
 * KB process route bulk-inserting chunks under a verified owner_id).
 */
export const supabaseAdmin = createClient(
  url || "https://placeholder.supabase.co",
  serviceRole || "placeholder-service-role-key",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
