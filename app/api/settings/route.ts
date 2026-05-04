import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase, getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBody = z.object({
  voice: z.string().nullable().optional(),
  model_id: z.string().nullable().optional(),
  persona: z.string().nullable().optional(),
  default_language: z.enum(["English", "Tagalog", "Bisaya"]).optional(),
});

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("user_settings")
    .select("voice, model_id, persona, default_language, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}

export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: user.id,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("voice, model_id, persona, default_language, updated_at")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
