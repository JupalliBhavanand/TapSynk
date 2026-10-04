import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "../AuthForms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <div className="fade-up">
      <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-muted">Sign in to manage your card, AI agent and bookings.</p>
      <div className="mt-8"><LoginForm next={next} linkError={sp.error === "link"} /></div>
      <p className="mt-6 text-center text-sm text-muted">
        New to TapSync? <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand hover:underline">Create an account</Link>
      </p>
    </div>
  );
}
