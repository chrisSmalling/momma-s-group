import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MonthCalendar from "@/components/MonthCalendar";
import Nav from "@/components/Nav";

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
        <Nav email={user.email ?? ""} />
        <MonthCalendar />
      </div>
    </div>
  );
}
