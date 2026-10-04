import { after, NextResponse, type NextRequest } from "next/server";
import { getPublicCard } from "@/lib/data";
import { REQUIRE_SUBSCRIPTION, SITE_URL } from "@/lib/env";
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

export async function GET(_: NextRequest, ctx: RouteContext<"/api/vcard/[slug]">) {
  const { slug } = await ctx.params;
  const found = await getPublicCard(slug);
  if (!found || !found.card.published || (REQUIRE_SUBSCRIPTION && !isActive(found.subscription))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const { card } = found;
  // Only fetch photos from our own Supabase storage.
  const storageHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "";
  const photoUrl = card.avatar_url && storageHost && new URL(card.avatar_url).host === storageHost ? card.avatar_url : "";
  const vcf = buildVCard(card, `${SITE_URL}/c/${card.slug}`, photoUrl ? await fetchPhoto(photoUrl) : undefined);
  after(async () => {
      await createAdminClient().rpc("bump_card_stat", { p_slug: slug, p_kind: "save" });
    });

  return new NextResponse(vcf, {
    headers: {
      "content-type": "text/vcard; charset=utf-8",
      "content-disposition": `attachment; filename="${slugify(card.full_name) || "contact"}.vcf"`,
      "cache-control": "no-store",
    },
  });
}
