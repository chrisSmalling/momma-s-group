"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability/offline shell is a nice-to-have; a failed
        // registration shouldn't affect the rest of the app.
      });
    }
  }, []);

  return null;
}
