import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = new Set(["helpful", "not_helpful", "saved", "dismissed"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const requestId = typeof body.requestId === "string" ? body.requestId : null;
  const candidateId = typeof body.candidateId === "string" ? body.candidateId : null;
  const feedback = typeof body.feedback === "string" ? body.feedback : null;
  if (!requestId || !candidateId || !feedback || !ALLOWED.has(feedback)) return NextResponse.json({ error: "Invalid feedback." }, { status: 400 });

  const { data: recommendationRequest } = await supabase
    .from("recommendation_requests")
    .select("id")
    .eq("id", requestId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!recommendationRequest) return NextResponse.json({ error: "Recommendation not found." }, { status: 404 });

  const { error } = await supabase.from("recommendation_feedback").insert({ request_id: requestId, candidate_id: candidateId, feedback });
  if (error) {
    console.error("[poppy] feedback insert failed", error.message);
    return NextResponse.json({ error: "Could not save feedback." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
