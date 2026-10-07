"use client";

import { useRef, useState, useTransition } from "react";
import { Bot, Check, ImagePlus, Loader2, Printer as PrinterIcon, UserPlus, X } from "lucide-react";
import { AI_BUTTON } from "@/lib/greeting";
import { CardPrinter } from "@/components/CardPrinter";
import { PhysicalCard } from "@/components/PhysicalCard";
import { ProfileCard } from "@/components/ProfileCard";
import { SocialFields } from "@/components/SocialFields";
import { createClient } from "@/lib/supabase/client";
import type { Card, Socials } from "@/lib/types";
import { cn, slugify } from "@/lib/utils";
import { saveCard, type CardInput } from "../actions";

const ACCENTS = ["#1d5bff", "#7c5cff", "#0ea5a4", "#10a765", "#f59e0b", "#e11d48", "#0f1426"];

type Form = { [K in Exclude<keyof CardInput, "socials" | "published">]-?: string } & { socials: Socials; published: boolean };

export function CardEditor({
  initial,
  userId,
  defaultName,
  siteUrl,
  aiPlan,
}: {
  initial: Card | null;
  userId: string;
  defaultName: string;
  siteUrl: string;
  aiPlan: boolean;
}) {
  const [form, setForm] = useState<Form>(() => ({
    slug: initial?.slug ?? slugify(defaultName) ?? "",
    full_name: initial?.full_name ?? defaultName,
    job_title: initial?.job_title ?? "",
    company: initial?.company ?? "",
    bio: initial?.bio ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    website: initial?.website ?? "",
    address: initial?.address ?? "",
    avatar_url: initial?.avatar_url ?? "",
    logo_url: initial?.logo_url ?? "",
    accent: initial?.accent ?? ACCENTS[0]!,
    socials: initial?.socials ?? {},
    published: initial?.published ?? true,
  }));
  const [view, setView] = useState<"profile" | "card">("profile");
  const [status, setStatus] = useState<{ error?: string; saved?: boolean }>({});
  const [printing, setPrinting] = useState(false);
  const [uploading, setUploading] = useState<"avatar_url" | "logo_url" | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus({});
  };
  const setSocial = (key: keyof Socials, value: string) => set("socials", { ...form.socials, [key]: value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveCard(form);
      if (!res.ok) return setStatus({ error: res.error });
      setStatus({ saved: true });
      if (res.data?.firstPrint) setPrinting(true);
    });
  }

  async function upload(field: "avatar_url" | "logo_url", file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setStatus({ error: "Upload a PNG, JPG or WebP image." });
    if (file.size > 2 * 1024 * 1024) return setStatus({ error: "Images must be under 2 MB." });
    setUploading(field);
    const supabase = createClient();
    const ext = file.type.split("/")[1];
    const path = `${userId}/${field === "avatar_url" ? "avatar" : "logo"}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("card-assets")
      .upload(path, file, { contentType: file.type, upsert: false })
      .catch(() => ({ error: true }));
    setUploading(null);
    if (error) return setStatus({ error: "Upload failed. Please try again." });
    set(field, supabase.storage.from("card-assets").getPublicUrl(path).data.publicUrl);
  }

  const link = `${siteUrl}/c/${form.slug}`;

  return (
    <>
      <form onSubmit={submit} className="grid gap-8 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <section className="card-surface p-6">
            <h2 className="font-bold">Photo & branding</h2>
            <div className="mt-4 flex flex-wrap gap-4">
              <ImageField label="Profile photo" value={form.avatar_url} busy={uploading === "avatar_url"} onFile={(f) => upload("avatar_url", f)} onClear={() => set("avatar_url", "")} />
              <ImageField label="Company logo" value={form.logo_url} busy={uploading === "logo_url"} onFile={(f) => upload("logo_url", f)} onClear={() => set("logo_url", "")} />
            </div>
            <p className="label mt-5">Card colour</p>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("accent", c)}
                  className={cn("grid h-9 w-9 place-items-center rounded-full ring-offset-2 transition", form.accent === c && "ring-2 ring-ink")}
                  style={{ background: c }}
                  aria-label={`Accent ${c}`}
                >
                  {form.accent === c && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
              <label className="relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-line text-xs text-muted" title="Custom colour">
                +
                <input type="color" value={form.accent} onChange={(e) => set("accent", e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
            </div>
          </section>

          <section className="card-surface p-6">
            <h2 className="font-bold">About you</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" value={form.full_name} onChange={(v) => set("full_name", v)} required maxLength={80} autoComplete="name" />
              <Field label="Job title" value={form.job_title ?? ""} onChange={(v) => set("job_title", v)} maxLength={80} placeholder="Founder & CEO" />
              <Field label="Company" value={form.company ?? ""} onChange={(v) => set("company", v)} maxLength={80} />
              <div>
                <label className="label" htmlFor="slug">Your card link</label>
                <div className="flex items-center overflow-hidden rounded-xl border border-line bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
                  <span className="pl-3 text-sm text-muted">/c/</span>
                  <input id="slug" value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40))} required minLength={3} maxLength={40} className="w-full px-1 py-2.5 text-sm outline-none" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="bio">Short bio</label>
                <textarea id="bio" value={form.bio ?? ""} onChange={(e) => set("bio", e.target.value)} maxLength={400} rows={3} className="input resize-none" placeholder="What you do and who you help, in a sentence or two." />
                <p className="mt-1 text-right text-xs text-muted">{(form.bio ?? "").length}/400</p>
              </div>
            </div>
          </section>

          <section className="card-surface p-6">
            <h2 className="font-bold">Contact details</h2>
            <p className="text-sm text-muted">These are saved to people's phones when they tap “Save contact”.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Email" type="email" value={form.email ?? ""} onChange={(v) => set("email", v)} autoComplete="email" />
              <Field label="Phone" type="tel" value={form.phone ?? ""} onChange={(v) => set("phone", v)} autoComplete="tel" placeholder="+1 555 123 4567" />
              <Field label="Website" value={form.website ?? ""} onChange={(v) => set("website", v)} placeholder="yourbusiness.com" />
              <Field label="Address" value={form.address ?? ""} onChange={(v) => set("address", v)} maxLength={200} />
            </div>
          </section>

          <section className="card-surface p-6">
            <h2 className="font-bold">Social links</h2>
            <p className="text-sm text-muted">Paste a link or just your @handle. Each one shows on your card with its logo.</p>
            <div className="mt-4">
              <SocialFields value={form.socials} onChange={setSocial} />
            </div>
          </section>
        </div>

        {/* preview + save */}
        <div className="xl:sticky xl:top-8 xl:self-start">
          <div className="mb-4 flex rounded-xl border border-line bg-white p-1 text-sm font-semibold">
            {(["profile", "card"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={cn("flex-1 rounded-lg py-2 transition", view === v ? "bg-navy text-white" : "text-muted")}>
                {v === "profile" ? "Tap page" : "smart card"}
              </button>
            ))}
          </div>
          {view === "profile" ? (
            <ProfileCard
              card={form as Card}
              actions={
                <>
                  <span className="btn btn-dark w-full"><UserPlus className="h-4 w-4" /> Save contact</span>
                  {aiPlan && <span className="btn btn-primary w-full"><Bot className="h-4 w-4" /> {AI_BUTTON}</span>}
                </>
              }
            />
          ) : (
            <div className="[container-type:inline-size]">
              <PhysicalCard card={{ ...form, job_title: form.job_title ?? "", company: form.company ?? "", ai: aiPlan }} />
            </div>
          )}

          <div className="card-surface mt-6 p-5">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block font-semibold">Published</span>
                <span className="block text-sm text-muted">Live at {link.replace(/^https?:\/\//, "")}</span>
              </span>
              <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} className="peer sr-only" />
              <span className="relative h-7 w-12 shrink-0 rounded-full bg-line transition peer-checked:bg-success after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
            </label>
            {status.error && <p role="alert" className="mt-4 text-sm text-stamp">{status.error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="btn btn-primary flex-1" disabled={pending || uploading !== null}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : status.saved ? <Check className="h-4 w-4" /> : null}
                {pending ? "Saving…" : status.saved ? "Saved" : initial ? "Save changes" : "Create & print my card"}
              </button>
              {initial?.first_printed_at && (
                <button type="button" className="btn btn-cream" onClick={() => setPrinting(true)} aria-label="Re-print card">
                  <PrinterIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      {printing && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#f4f5f8]/90 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Printing your card">
          <div className="fade-up relative w-full max-w-lg rounded-[28px] bg-white px-6 pb-8 pt-14 shadow-2xl">
            <button type="button" onClick={() => setPrinting(false)} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-bg text-muted hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <CardPrinter card={{ ...form, job_title: form.job_title ?? "", company: form.company ?? "", ai: aiPlan }} link={link} />
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input" {...rest} />
    </div>
  );
}

function ImageField({ label, value, busy, onFile, onClear }: { label: string; value: string; busy: boolean; onFile: (f: File) => void; onClear: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => ref.current?.click()} className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-bg text-muted transition hover:border-brand">
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-5 w-5" />
        )}
      </button>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <div className="flex gap-3 text-xs">
          <button type="button" className="font-semibold text-brand" onClick={() => ref.current?.click()}>{value ? "Change" : "Upload"}</button>
          {value && <button type="button" className="text-muted" onClick={onClear}>Remove</button>}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // lets the same file be picked again after an error
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
