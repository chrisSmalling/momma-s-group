"use client";

import { useState } from "react";

export default function GroupInvite({ groupName, inviteCode }: { groupName: string; inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/groups?invite=${encodeURIComponent(inviteCode)}` : "";
  const message = `Join ${groupName} on Momma's Meetup — use this invite link: ${inviteUrl}`;

  async function copy() {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  }
  async function share() {
    if (navigator.share) { try { await navigator.share({ title: `Join ${groupName}`, text: `Join ${groupName} on Momma's Meetup`, url: inviteUrl }); setShared(true); setTimeout(() => setShared(false), 1800); } catch {} }
    else await copy();
  }
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
    <div className="text-sm font-bold text-zinc-900">Invite moms to {groupName}</div>
    <p className="mt-0.5 text-xs leading-5 text-zinc-600">Share a link instead of making friends type an invite code.</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" onClick={share} className="min-h-11 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-bold text-white">{shared ? "Shared ✓" : "Share invite"}</button>
      <button type="button" onClick={copy} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-bold text-zinc-900">{copied ? "Copied ✓" : "Copy link"}</button>
    </div>
    <div className="mt-2 text-[11px] text-zinc-500">Invite code: <span className="font-mono font-bold tracking-wider">{inviteCode}</span></div>
  </div>;
}
