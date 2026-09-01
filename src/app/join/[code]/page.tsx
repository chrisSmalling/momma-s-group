import { redirect } from "next/navigation";

// Was its own silent join-then-redirect implementation (no confirmation,
// raw RPC error strings on failure) — a second, worse copy of what
// /join?code= already does well. Redirecting here instead of duplicating
// that logic means there's exactly one join flow to keep correct.
export default async function JoinCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const inviteCode = decodeURIComponent(code).trim().toLowerCase();
  redirect(`/join?code=${encodeURIComponent(inviteCode)}`);
}
