import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20">
      <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
      <div className="mt-8 space-y-5 text-ink-2">
        <p>These starter terms should be reviewed by a lawyer before launch.</p>
        <p><strong>Subscriptions.</strong> Plans renew automatically each billing period until cancelled. You can cancel any time from the billing portal; access continues until the end of the paid period.</p>
        <p><strong>Physical cards.</strong> One smart card is included with each new subscription and shipped to the address provided at checkout.</p>
        <p><strong>Acceptable use.</strong> Don't publish unlawful, misleading or infringing content, and don't use the AI agent to collect sensitive personal data.</p>
        <p><strong>AI answers.</strong> The AI agent answers from the information you provide. You are responsible for keeping that information accurate.</p>
      </div>
    </main>
  );
}
