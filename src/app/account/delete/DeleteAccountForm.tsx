"use client";

import { useState } from "react";
import { deleteAccount } from "./actions";

const CONFIRM_WORD = "DELETE";

export default function DeleteAccountForm() {
  const [confirmText, setConfirmText] = useState("");
  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <form action={deleteAccount} className="mt-6">
      <label htmlFor="confirm-delete" className="text-xs font-semibold text-zinc-700">
        Type {CONFIRM_WORD} to confirm
      </label>
      <input
        id="confirm-delete"
        type="text"
        autoComplete="off"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={CONFIRM_WORD}
        className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-300 px-3.5 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
      />
      <button
        type="submit"
        disabled={!confirmed}
        className="mt-4 min-h-11 w-full rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
      >
        Permanently delete my account
      </button>
    </form>
  );
}
