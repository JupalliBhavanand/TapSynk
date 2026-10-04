import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "../AuthForms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <div className="fade-up">
      <h1 className="text-3xl font-bold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-muted">We'll email you a secure link to choose a new one.</p>
      <div className="mt-8"><ForgotForm /></div>
      <p className="mt-6 text-center text-sm text-muted"><Link href="/login" className="font-semibold text-brand hover:underline">Back to sign in</Link></p>
    </div>
  );
}
