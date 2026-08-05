import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MonthCalendar from "@/components/MonthCalendar";
import SignOutButton from "@/components/SignOutButton";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm text-zinc-500">{user.email}</span>
          <SignOutButton />
        </div>
        <MonthCalendar />
      </div>
    </div>
  );
}
