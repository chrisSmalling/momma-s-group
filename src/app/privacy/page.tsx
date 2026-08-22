import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · Momma's Meetup",
  description: "How Momma's Meetup collects, uses, protects, and deletes information.",
};

const updated = "August 22, 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 text-slate-900">
      <p className="text-sm font-medium text-pink-700">Momma&apos;s Meetup</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated {updated}</p>

      <div className="prose prose-slate mt-8 max-w-none">
        <p>Momma&apos;s Meetup is a private family activity discovery and group-planning service. This policy explains what information we collect, why we use it, and the choices you have.</p>
        <h2>Information we collect</h2>
        <ul>
          <li><strong>Account information:</strong> email address and basic profile information needed to operate your account.</li>
          <li><strong>Group activity:</strong> groups you create or join, invitations, RSVPs, availability, comments, tips, and outing feedback.</li>
          <li><strong>Location information:</strong> location you choose to provide for local activity recommendations and travel estimates. We do not store a child profile or a child&apos;s precise location.</li>
          <li><strong>Technical information:</strong> information reasonably necessary to secure, operate, troubleshoot, and improve the service.</li>
        </ul>
        <h2>Children</h2>
        <p>Momma&apos;s Meetup is designed for parents and caregivers. We intentionally do not create child profiles or collect children&apos;s names, dates of birth, photographs, or precise locations. Activity age ranges describe an event, not a particular child.</p>
        <h2>How we use information</h2>
        <p>We use information to authenticate accounts, operate private groups, coordinate plans, personalize activity discovery, provide notifications, maintain security, prevent abuse, and improve reliability.</p>
        <h2>Sharing</h2>
        <p>Group information is private to members of the relevant group. We do not sell personal information. We may use service providers that process information only as needed to provide infrastructure, authentication, hosting, analytics, notifications, or other operating services.</p>
        <h2>Public activity data</h2>
        <p>Momma&apos;s Meetup may collect publicly available event information from organizers and public calendars. We prefer authoritative organizer sources and honor applicable crawl restrictions and takedown requests.</p>
        <h2>Security and retention</h2>
        <p>We use database access controls and row-level security to limit access to private group information. We retain information only for as long as reasonably necessary to operate the service, meet legal obligations, resolve disputes, and maintain security.</p>
        <h2>Your choices and deletion</h2>
        <p>You can permanently delete your account from the <Link href="/account/delete">in-app account deletion page</Link>. Deletion removes your account and personal activity associated with it. Groups and events that other members rely on may remain, with your ownership identity removed where applicable. Some records may be retained when required for security, fraud prevention, legal compliance, or legitimate operational purposes.</p>
        <h2>Changes</h2>
        <p>We may update this policy as the service changes. Material changes will be communicated through the service or other appropriate means.</p>
        <h2>Contact</h2>
        <p>For privacy questions or data concerns, use the support channel provided in the application.</p>
      </div>
    </main>
  );
}
