import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy · Momma's Meetup",
  description: "How Momma's Meetup collects, uses, protects, and deletes information.",
};

const updated = "August 22, 2026";

export default function PrivacyPage() {
  return (
    <>
    <main className="mx-auto w-full max-w-3xl px-5 py-10 text-zinc-900">
      <Link href="/today" className="inline-flex min-h-11 items-center text-sm font-semibold text-rose-700 hover:underline">← Back to Momma&apos;s Meetup</Link>
      <p className="mt-6 text-sm font-medium text-rose-600">Momma&apos;s Meetup</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-600">Last updated {updated}</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-6 text-zinc-700 [&_h2]:font-display [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-zinc-950 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5 [&_li]:leading-6 [&_strong]:font-semibold [&_strong]:text-zinc-900 [&_a]:font-semibold [&_a]:text-rose-700 [&_a]:underline [&_a]:underline-offset-2">
        <p>Momma&apos;s Meetup is a private family activity discovery and group-planning service. This policy explains what information we collect, why we use it, and the choices you have.</p>
        <div>
        <h2>Information we collect</h2>
        <ul>
          <li><strong>Account information:</strong> email address and basic profile information needed to operate your account.</li>
          <li><strong>Group activity:</strong> groups you create or join, invitations, RSVPs, availability, comments, tips, and outing feedback.</li>
          <li><strong>Location information:</strong> location you choose to provide for local activity recommendations and travel estimates. We do not store a child profile or a child&apos;s precise location.</li>
          <li><strong>Technical information:</strong> information reasonably necessary to secure, operate, troubleshoot, and improve the service.</li>
        </ul>
        </div>
        <div><h2>Children</h2>
        <p>Momma&apos;s Meetup is designed for parents and caregivers. We intentionally do not create child profiles or collect children&apos;s names, dates of birth, photographs, or precise locations. Activity age ranges describe an event, not a particular child.</p></div>
        <div><h2>How we use information</h2>
        <p>We use information to authenticate accounts, operate private groups, coordinate plans, personalize activity discovery, provide notifications, maintain security, prevent abuse, and improve reliability.</p></div>
        <div><h2>Sharing</h2>
        <p>Group information is private to members of the relevant group. We do not sell personal information. We may use service providers that process information only as needed to provide infrastructure, authentication, hosting, analytics, notifications, or other operating services.</p></div>
        <div><h2>Public activity data</h2>
        <p>Momma&apos;s Meetup may collect publicly available event information from organizers and public calendars. We prefer authoritative organizer sources and honor applicable crawl restrictions and takedown requests.</p></div>
        <div><h2>Security and retention</h2>
        <p>We use database access controls and row-level security to limit access to private group information. We retain information only for as long as reasonably necessary to operate the service, meet legal obligations, resolve disputes, and maintain security.</p></div>
        <div><h2>Your choices and deletion</h2>
        <p>You can permanently delete your account from the <Link href="/account/delete">in-app account deletion page</Link>. Deletion removes your account and personal activity associated with it. Groups and events that other members rely on may remain, with your ownership identity removed where applicable. Some records may be retained when required for security, fraud prevention, legal compliance, or legitimate operational purposes.</p></div>
        <div><h2>Changes</h2>
        <p>We may update this policy as the service changes. Material changes will be communicated through the service or other appropriate means.</p></div>
        <div><h2>Contact</h2>
        <p>For privacy questions or data concerns, use the support channel provided in the application.</p></div>
      </div>
    </main>
    <SiteFooter />
    </>
  );
}
