"use client";

import { useState } from "react";

// A real, tappable link — visiting it while already signed in just
// (re)joins the group harmlessly via join_group_by_code's on-conflict-do-
// nothing. The raw code stays visible underneath for manual entry.
export default function InviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/join/${code}`;

  async function handleCopy() {
    try {
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable/denied — the link below still works.
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5 text-xs">
      <div className="flex items-center gap-2">
        <a href={path} className="font-mono text-zinc-500 underline">
          {path}
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 text-zinc-400 underline hover:text-zinc-600"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      <span className="text-zinc-400">or share code: {code}</span>
    </div>
  );
}
