import { after, NextResponse, type NextRequest } from "next/server";
import { getPublicCard } from "@/lib/data";
import { REQUIRE_SUBSCRIPTION, SITE_URL } from "@/lib/env";
import { parseSource } from "@/lib/source";
import { createAdminClient } from "@/lib/supabase/admin";
import { isActive } from "@/lib/types";
import { slugify } from "@/lib/utils";
import { buildVCard } from "@/lib/vcard";

async function fetchPhoto(url: string) {
  if (!url.startsWith("https://")) return undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !/image\/(jpeg|png)/.test(type)) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 600_000) return undefined;
    return { base64: buf.toString("base64"), type: type.includes("png") ? "PNG" : "JPEG" };
  } catch {
    return undefined;
  }
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/vcard/[slug]">) {
  const { slug: requestedSlug } = await ctx.params;
  // A real .vcf URL helps browsers identify the file. Keep older links working.
  const slug = requestedSlug.replace(/\.vcf$/i, "");
  const found = await getPublicCard(slug);
  if (!found || !found.card.published || (REQUIRE_SUBSCRIPTION && !isActive(found.subscription))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const { card } = found;
  // Only fetch photos from our own Supabase storage.
  const storageHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "";
  let photoUrl = "";
  try {
    if (card.avatar_url && storageHost) {
      const avatar = new URL(card.avatar_url);
      if (avatar.protocol === "https:" && avatar.host === storageHost) photoUrl = avatar.href;
    }
  } catch {
    // An invalid optional photo must not prevent saving the contact itself.
  }
  const vcf = buildVCard(card, `${SITE_URL}/c/${card.slug}`, photoUrl ? await fetchPhoto(photoUrl) : undefined);
  after(async () => {
    await createAdminClient().rpc("bump_card_stat", { p_slug: slug, p_kind: "save", p_source: parseSource(request.nextUrl.searchParams.get("s")) });
  });

  return new NextResponse(vcf, {
    headers: {
      "content-type": "text/vcard; charset=utf-8",
      // Allow the OS contact preview instead of always forcing a download.
      // Browsers without a preview still have an explicit download fallback.
      "content-disposition": `${request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${slugify(card.full_name) || "contact"}.vcf"`,
      "cache-control": "no-store",
    },
  });
}
