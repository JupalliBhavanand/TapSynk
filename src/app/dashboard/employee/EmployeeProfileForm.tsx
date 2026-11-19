"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Card } from "@/lib/types";
import { updateEmployeeProfile } from "./actions";

export function EmployeeProfileForm({ card }: { card: Card }) {
  const [form, setForm] = useState({ full_name: card.full_name, job_title: card.job_title, phone: card.phone, bio: card.bio });
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="mt-6 space-y-4" onSubmit={(event) => {
      event.preventDefault();
      setMessage("");
      start(async () => {
        try {
          const result = await updateEmployeeProfile(card.id, form);
          setMessage(result.ok ? "Your profile has been saved." : result.error ?? "Could not save your profile.");
          if (result.ok) router.refresh();
        } catch { setMessage("Could not save your profile. Please try again."); }
      });
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        {([['full_name', 'Full name', 80], ['job_title', 'Job title', 80], ['phone', 'Phone', 40]] as const).map(([key, label, max]) => (
          <label key={key} className="block"><span className="label">{label}</span><input className="input" value={form[key]} maxLength={max} required={key === 'full_name'} minLength={key === 'full_name' ? 2 : undefined} type={key === 'phone' ? 'tel' : 'text'} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>
        ))}
        <div><span className="label">Work email</span><p className="py-3 text-sm">{card.email}</p></div>
      </div>
      <label className="block"><span className="label">About you</span><textarea className="input" rows={3} maxLength={400} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label>
      <p className="text-sm text-muted">Your company manages your work email, branding and AI assistant.</p>
      <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save my profile"}</button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  );
}
