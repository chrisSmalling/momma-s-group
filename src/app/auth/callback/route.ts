import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null): string {
  if (!value) return "/today";
  // Only allow relative application paths. Reject protocol-relative URLs,
  // absolute URLs, and malformed values that could become an open redirect.
  if (!value.startsWith("/") || value.startsWith("//")) return "/today";
  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost") return "/today";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/today";
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
