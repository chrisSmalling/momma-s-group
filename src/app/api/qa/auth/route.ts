import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Constant-time compare — a plain !== leaks how many leading characters of
// the secret an attacker guessed right via response timing.
function secretsMatch(supplied: string, configured: string): boolean {
  const suppliedBuf = Buffer.from(supplied);
  const configuredBuf = Buffer.from(configured);
  if (suppliedBuf.length !== configuredBuf.length) return false;
  return timingSafeEqual(suppliedBuf, configuredBuf);
}

/**
 * Test-only authentication bootstrap for Browserbase QA.
 * It establishes a normal Supabase session for the dedicated QA account.
 * Keep this route gated by QA_AUTH_SECRET and remove it after the audit pass.
 */
export async function POST(request: Request) {
  const configuredSecret = process.env.QA_AUTH_SECRET;
  const suppliedSecret = request.headers.get("x-qa-auth-secret") ?? "";

  // Same response either way — an unset secret returning 404 previously let
  // a prober distinguish "route disabled" from "route live, wrong secret".
  if (!configuredSecret || !secretsMatch(suppliedSecret, configuredSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return NextResponse.json({ error: "QA authentication failed" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, userId: data.user.id });
}
