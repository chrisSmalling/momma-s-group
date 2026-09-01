import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinGroup } from "../(app)/groups/actions";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams;
  const code = String(params.code ?? "").trim().toLowerCase();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!code) redirect("/groups?error=This%20invite%20link%20is%20missing%20its%20invite%20code");
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join?code=${encodeURIComponent(code)}`)}`);

  const { data: group } = await supabase.from("groups").select("id,name").eq("invite_code", code).maybeSingle();
  if (!group) redirect("/groups?error=That%20invite%20is%20no%20longer%20valid");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-rose-50 via-white to-white px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-xl sm:p-9">
        <div className="text-xs font-extrabold uppercase tracking-wider text-rose-600">Momma&apos;s Meetup</div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-950">You&apos;re invited</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Join <strong>{group.name}</strong> to see what your friends are planning, get notified about new meetups, and see who&apos;s going.</p>
        <form action={joinGroup} className="mt-6">
          <input type="hidden" name="code" value={code} />
          <button type="submit" className="min-h-12 w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-rose-700">Join {group.name}</button>
        </form>
        <p className="mt-4 text-center text-[11px] leading-5 text-zinc-600">You&apos;ll only see activity shared with members of this group.</p>
      </div>
    </main>
  );
}
