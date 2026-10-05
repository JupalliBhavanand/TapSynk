"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bot, Loader2, UserPlus } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";
import { PhysicalCard } from "@/components/PhysicalCard";
import { ProfileCard } from "@/components/ProfileCard";
import type { Card, Company } from "@/lib/types";
import { slugify } from "@/lib/utils";
import { saveEmployeeCard } from "./actions";

export function EmployeeCardForm({ initial, company, userId, siteUrl }: { initial: Card | null; company: Company; userId: string; siteUrl: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: initial?.full_name ?? "",
    job_title: initial?.job_title ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    bio: initial?.bio ?? "",
    slug: initial?.slug ?? "",
    avatar_url: initial?.avatar_url ?? "",
    published: initial?.published ?? true,
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "full_name" && !slugTouched) next.slug = slugify(`${company.name} ${v as string}`).slice(0, 40).replace(/-+$/, "");
      return next;
    });
    setError(null);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveEmployeeCard(initial?.id ?? null, form);
      if (!res.ok) return setError(res.error);
      router.push("/dashboard/company");
    });
  }

  const preview = { ...form, company: company.name, website: company.website, address: company.address, logo_url: company.logo_url, accent: company.accent, socials: {} };
  const ai = company.tier === "ai";

  return (
    <form onSubmit={submit} className="grid gap-8 xl:grid-cols-[1fr_400px]">
      <div className="space-y-6">
        <section className="card-surface p-6">
          <h2 className="font-bold">Employee details</h2>
          <p className="text-sm text-muted">Company name, logo, colour, website and address come from your company profile.</p>
          <div className="mt-5">
            <ImageUpload userId={userId} name="employee" label="Profile photo" value={form.avatar_url} onChange={(v) => set("avatar_url", v)} onError={setError} round />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field id="e-name" label="Full name" value={form.full_name} onChange={(v) => set("full_name", v)} required minLength={2} maxLength={80} />
            <Field id="e-title" label="Job title" value={form.job_title} onChange={(v) => set("job_title", v)} maxLength={80} placeholder="Sales Manager" />
            <Field id="e-email" label="Work email" type="email" value={form.email} onChange={(v) => set("email", v)} maxLength={120} />
            <Field id="e-phone" label="Phone" type="tel" value={form.phone} onChange={(v) => set("phone", v)} maxLength={40} />
            <div className="sm:col-span-2">
              <label className="label" htmlFor="e-slug">Card link</label>
              <div className="flex items-center overflow-hidden rounded-xl border border-line bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
                <span className="pl-3 text-sm text-muted">{siteUrl.replace(/^https?:\/\//, "")}/c/</span>
                <input
                  id="e-slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40));
                  }}
                  required
                  minLength={3}
                  maxLength={40}
                  className="w-full px-1 py-2.5 text-sm outline-none"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="e-bio">Short bio</label>
              <textarea id="e-bio" value={form.bio} onChange={(e) => set("bio", e.target.value)} maxLength={400} rows={3} className="input resize-none" />
            </div>
          </div>
          <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
            Card is live
          </label>
        </section>
        <div className="flex items-center gap-4">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {initial ? "Save card" : "Create card"}
          </button>
          {error && <p role="alert" className="text-sm text-stamp">{error}</p>}
        </div>
      </div>
      <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
        <ProfileCard
          card={preview}
          actions={
            <>
              <span className="btn btn-dark w-full"><UserPlus className="h-4 w-4" /> Save contact</span>
              {ai && <span className="btn btn-primary w-full"><Bot className="h-4 w-4" /> Talk to AI</span>}
            </>
          }
        />
        <div className="[container-type:inline-size]">
          <PhysicalCard card={{ full_name: form.full_name, job_title: form.job_title, company: company.name, accent: company.accent, logo_url: company.logo_url, ai }} />
        </div>
      </aside>
    </form>
  );
}

function Field({ id, label, value, onChange, ...rest }: { id: string; label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id">) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input" {...rest} />
    </div>
  );
}
