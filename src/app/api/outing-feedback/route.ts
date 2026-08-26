import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = new Set(["loved", "good", "not_for_us"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const eventId = typeof body.eventId === "string" ? body.eventId : null;
  const sentiment = typeof body.sentiment === "string" ? body.sentiment : null;
  if (!eventId || !sentiment || !ALLOWED.has(sentiment)) return NextResponse.json({ error: "Invalid feedback." }, { status: 400 });

  const { data: event } = await supabase.from("feed_events").select("id, ends_at").eq("id", eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (event.ends_at && new Date(event.ends_at).getTime() > Date.now()) return NextResponse.json({ error: "Feedback opens after the activity." }, { status: 400 });

  const { data: existing } = await supabase.from("outing_feedback").select("id").eq("event_id", eventId).eq("user_id", user.id).maybeSingle();
  const payload = { event_id: eventId, user_id: user.id, sentiment };
  const result = existing
    ? await supabase.from("outing_feedback").update(payload).eq("id", existing.id)
    : await supabase.from("outing_feedback").insert(payload);
  if (result.error) { console.error("[outing-feedback] write failed", result.error.message); return NextResponse.json({ error: "Could not save feedback." }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
