import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "../AuthForms";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create your TapSynk account and design your AI-powered smart business card in minutes.",
};

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <div className="fade-up">
      <h1 className="text-3xl font-bold tracking-tight">Create your card</h1>
      <p className="mt-2 text-muted">Free to design. Pick a plan when you're ready to go live.</p>
      <div className="mt-8"><SignupForm next={next} /></div>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-brand hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
