import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20">
      <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
      <div className="mt-8 space-y-5 text-ink-2">
        <p>This is a starter policy. Have it reviewed by a lawyer before launch.</p>
        <p><strong>What we collect.</strong> Account details (name, email), the business card information you publish, AI agent content you provide, appointment requests visitors submit, and shipping details for your physical card. Payment card details are collected and stored by Stripe, never by TapSynk.</p>
        <p><strong>How we use it.</strong> To run your card, power your AI agent, ship your card, and process payments. Visitor chats, and voice messages when a visitor taps the mic, are sent to our AI provider (Google Gemini) to understand them and generate spoken and written answers. Voice recordings are not stored by TapSynk.</p>
        <p><strong>Security.</strong> Data is encrypted in transit and at rest. Database access is restricted per account with row-level security.</p>
        <p><strong>Your rights.</strong> You can edit or delete your card at any time and request deletion of your account by emailing <a href="mailto:hello@tapsync.app" className="text-brand underline">our support team</a>.</p>
      </div>
    </main>
  );
}
