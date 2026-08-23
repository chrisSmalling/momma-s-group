import type { Metadata } from "next";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Terms of Service · Momma's Meetup",
  description: "Terms governing use of Momma's Meetup.",
};

const updated = "August 22, 2026";

export default function TermsPage() {
  return (
    <>
    <main className="mx-auto w-full max-w-3xl px-5 py-10 text-slate-900">
      <p className="text-sm font-medium text-pink-700">Momma&apos;s Meetup</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated {updated}</p>

      <div className="prose prose-slate mt-8 max-w-none">
        <p>These Terms govern your use of Momma&apos;s Meetup. By creating an account or using the service, you agree to these Terms.</p>
        <h2>The service</h2>
        <p>Momma&apos;s Meetup provides local family activity discovery and private group coordination tools. Event information is gathered from organizers and other sources and may change without notice.</p>
        <h2>Accounts and groups</h2>
        <p>You are responsible for maintaining access to your account and for activity performed through it. Group invitations are intended for people you know and trust. Do not share invitation codes publicly or attempt to access a group without authorization.</p>
        <h2>Community conduct</h2>
        <p>Do not harass, threaten, impersonate, spam, or post unlawful or harmful content. Do not use the service to expose another person&apos;s private information. We may remove content or restrict accounts when reasonably necessary to protect members or the service.</p>
        <h2>Event information and safety</h2>
        <p>Activity listings, schedules, prices, availability, weather information, and venue details can change. Always confirm important details with the organizer before traveling. Momma&apos;s Meetup does not guarantee that an activity will occur, be appropriate for a particular child, or remain available.</p>
        <h2>Venue information</h2>
        <p>Practical tips and group feedback are provided for convenience and may be incomplete or outdated. They are not guarantees about a venue or its facilities.</p>
        <h2>User content</h2>
        <p>You retain ownership of content you submit, while granting Momma&apos;s Meetup the limited permission necessary to display and operate that content within the service and the relevant private group.</p>
        <h2>Availability</h2>
        <p>We work to keep the service reliable, but the service may occasionally be unavailable for maintenance, outages, or circumstances outside our control.</p>
        <h2>Termination</h2>
        <p>You may stop using the service at any time. We may suspend or terminate access when necessary for security, abuse prevention, legal compliance, or material violation of these Terms.</p>
        <h2>Changes</h2>
        <p>We may update these Terms as the service develops. Continued use after an effective update constitutes acceptance of the revised Terms.</p>
        <h2>Contact</h2>
        <p>Questions about these Terms should be sent through the Momma&apos;s Meetup support channel provided in the application.</p>
      </div>
    </main>
    <SiteFooter />
    </>
  );
}
