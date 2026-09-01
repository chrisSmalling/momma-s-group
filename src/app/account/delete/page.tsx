import type { Metadata } from "next";
import Link from "next/link";
import DeleteAccountForm from "./DeleteAccountForm";

export const metadata: Metadata = {
  title: "Delete account · Momma's Meetup",
  description: "Permanently delete your Momma's Meetup account.",
};

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-12 text-zinc-900">
      <section className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-zinc-200">
        <p className="text-sm font-semibold text-rose-600">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Delete your account</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          This permanently deletes your Momma&apos;s Meetup account and personal activity associated with it.
          Your group membership, RSVPs, availability, comments, tips, and feedback will be removed.
          Groups and events that belong to other members can remain without your account.
        </p>
        <div className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-900">
          <strong>This cannot be undone.</strong> Make sure you really want to leave before continuing.
        </div>
        <DeleteAccountForm />
        <Link
          href="/settings"
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-200 px-5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Cancel, keep my account
        </Link>
      </section>
    </main>
  );
}
