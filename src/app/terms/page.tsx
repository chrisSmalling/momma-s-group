import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Terms of Service · Momma's Meetup",
  description: "Terms governing use of Momma's Meetup.",
};

const updated = "August 22, 2026";

export default function TermsPage() {
  return (
    <>
    <main className="mx-auto w-full max-w-3xl px-5 py-10 text-zinc-900">
      <Link href="/today" className="inline-flex min-h-11 items-center text-sm font-semibold text-rose-700 hover:underline">← Back to Momma&apos;s Meetup</Link>
      <p className="mt-6 text-sm font-medium text-rose-600">Momma&apos;s Meetup</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-zinc-600">Last updated {updated}</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-6 text-zinc-700 [&_h2]:font-display [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-zinc-950">
        <p>These Terms govern your use of Momma&apos;s Meetup. By creating an account or using the service, you agree to these Terms.</p>
        <div><h2>The service</h2>
        <p>Momma&apos;s Meetup provides local family activity discovery and private group coordination tools. Event information is gathered from organizers and other sources and may change without notice.</p></div>
        <div><h2>Accounts and groups</h2>
        <p>You are responsible for maintaining access to your account and for activity performed through it. Group invitations are intended for people you know and trust. Do not share invitation codes publicly or attempt to access a group without authorization.</p></div>
        <div><h2>Community conduct</h2>
        <p>Do not harass, threaten, impersonate, spam, or post unlawful or harmful content. Do not use the service to expose another person&apos;s private information. We may remove content or restrict accounts when reasonably necessary to protect members or the service.</p></div>
        <div><h2>Event information and safety</h2>
        <p>Activity listings, schedules, prices, availability, weather information, and venue details can change. Always confirm important details with the organizer before traveling. Momma&apos;s Meetup does not guarantee that an activity will occur, be appropriate for a particular child, or remain available.</p></div>
        <div><h2>Venue information</h2>
        <p>Practical tips and group feedback are provided for convenience and may be incomplete or outdated. They are not guarantees about a venue or its facilities.</p></div>
        <div><h2>User content</h2>
        <p>You retain ownership of content you submit, while granting Momma&apos;s Meetup the limited permission necessary to display and operate that content within the service and the relevant private group.</p></div>
        <div><h2>Availability</h2>
        <p>We work to keep the service reliable, but the service may occasionally be unavailable for maintenance, outages, or circumstances outside our control.</p></div>
        <div><h2>Termination</h2>
        <p>You may stop using the service at any time. We may suspend or terminate access when necessary for security, abuse prevention, legal compliance, or material violation of these Terms.</p></div>
        <div><h2>Changes</h2>
        <p>We may update these Terms as the service develops. Continued use after an effective update constitutes acceptance of the revised Terms.</p></div>
        <div><h2>Contact</h2>
        <p>Questions about these Terms should be sent through the Momma&apos;s Meetup support channel provided in the application.</p></div>
      </div>
    </main>
    <SiteFooter />
    </>
  );
}
