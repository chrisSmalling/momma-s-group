import type { ReactNode } from "react";

// Wraps every signed-in page (today, places, calendar, groups, settings,
// free — see each folder's Nav usage). .has-tabbar (globals.css) reserves
// bottom clearance for Nav's fixed bottom tab bar so content never sits
// behind it; the global footer intentionally does NOT render here (see
// root layout.tsx) since the tab bar replaces it for signed-in users —
// legal links are reachable from Settings instead.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <div className="has-tabbar flex min-h-full flex-1 flex-col">{children}</div>;
}
