import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Only run the Supabase session refresh on application/server routes that can
// actually need an authenticated session. In particular, do not run auth
// middleware on the OAuth callback itself: doing so adds an unnecessary
// getUser() round trip before exchangeCodeForSession(), which can make an
// already-slow provider callback dramatically slower.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|apple-icon|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|auth/callback|login|invite|join|privacy|terms).*)",
  ],
};
