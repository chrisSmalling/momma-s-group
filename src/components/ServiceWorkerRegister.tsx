"use client";

import { useEffect, useState } from "react";

export default function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            // A controller already existing means this install replaces a
            // previously active worker (a real update), not the first-ever
            // install for this browser.
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => {
        // Installability/offline shell is a nice-to-have; a failed
        // registration shouldn't affect the rest of the app.
      });
  }, []);

  if (!updateReady) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-[70] flex justify-center px-4 sm:bottom-4">
      <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg">
        <span className="font-semibold">A new version is ready</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 shrink-0 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
