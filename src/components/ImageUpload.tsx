"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Uploads a PNG/JPG/WebP (max 2 MB) to the signed-in user's folder in card-assets and returns its public URL. */
export function ImageUpload({
  userId,
  name,
  label,
  value,
  onChange,
  onError,
  round = false,
}: {
  userId: string;
  name: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  onError: (message: string) => void;
  round?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return onError("Upload a PNG, JPG or WebP image.");
    if (file.size > 2 * 1024 * 1024) return onError("Images must be under 2 MB.");
    setBusy(true);
    const supabase = createClient();
    const path = `${userId}/${name}-${Date.now()}.${file.type.split("/")[1]}`;
    const { error } = await supabase.storage.from("card-assets").upload(path, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (error) return onError("Upload failed. Please try again.");
    onChange(supabase.storage.from("card-assets").getPublicUrl(path).data.publicUrl);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`relative grid h-16 w-16 place-items-center overflow-hidden border border-dashed border-line bg-bg text-muted transition hover:border-brand ${round ? "rounded-full" : "rounded-2xl"}`}
        aria-label={`Upload ${label.toLowerCase()}`}
      >
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
          {value && <button type="button" className="text-muted" onClick={() => onChange("")}>Remove</button>}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  );
}
