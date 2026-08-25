import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Test-only authentication bootstrap for Browserbase QA.
 *
 * This route never grants access by itself: it only establishes a normal
 * Supabase session for a dedicated QA account. It is protected by a secret
 * that must exist in the production environment, and the protected app
 * routes remain unchanged.
 */
export async function POST(request: Request) {
  const configuredSecret = process.env.QA_AUTH_SECRET;
  const suppliedSecret = request.headers.get("x-qa-auth-secret");

  if (!configuredSecret) {
    return new NextResponse(null, { status: 404 });
  }

  if (!suppliedSecret || suppliedSecret !== configuredSecret) {
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
