import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ResetForm } from "../AuthForms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPage() {
  const { user } = await getUser();
  if (!user) redirect("/forgot-password");
  return (
    <div className="fade-up">
      <h1 className="text-3xl font-bold tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-muted">You'll be signed in right after.</p>
      <div className="mt-8"><ResetForm /></div>
    </div>
  );
}
