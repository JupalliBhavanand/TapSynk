import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicCard } from "@/lib/data";
import { env, REQUIRE_SUBSCRIPTION } from "@/lib/env";
import { clickNoise, linkClickSource, profileLinks } from "@/lib/profile-links";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isActive } from "@/lib/types";
import { clientIp } from "@/lib/utils";

export const runtime = "nodejs";
const schema = z.object({ event_id: z.uuid(), visitor_id: z.uuid().optional(), link_id: z.string().min(1).max(80), link_url: z.string().min(1).max(2048), source: z.string().max(10).optional(), referrer: z.string().max(2048).optional() });
const empty = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/** POST only: crawlers following GET links and browser prefetches cannot record clicks. */
export async function POST(request: Request, context: RouteContext<"/api/clicks/[slug]">) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new NextResponse(null, { status: 403 });
  if (clickNoise(request.headers)) return empty();
  const { slug } = await context.params;
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return new NextResponse(null, { status: 404 });
  if (Number(request.headers.get("content-length")) > 4096) return new NextResponse(null, { status: 413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 4096) return new NextResponse(null, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return new NextResponse(null, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  try {
    const hash = (value: string) => createHmac("sha256", env.supabaseServiceKey()).update(value).digest("hex");
    const network = hash(clientIp(request.headers));
    if (!await rateLimit(`link-click:${network}`, 120, 60)) return new NextResponse(null, { status: 429 });
    const found = await getPublicCard(slug);
    if (!found || !found.card.published || (REQUIRE_SUBSCRIPTION && !isActive(found.subscription))) return new NextResponse(null, { status: 404 });
    // A stale open profile must not attribute an old destination's click to its replacement.
    const link = profileLinks(found.card).find((value) => value.id === parsed.data.link_id && value.href === parsed.data.link_url);
    if (!link) return new NextResponse(null, { status: 400 });
    const agent = (request.headers.get("user-agent") ?? "").slice(0, 512);
    // No raw IP or referrer path/query is stored.
    let referrer: string | null = null;
    try { const url = new URL(parsed.data.referrer || ""); if (/^https?:$/.test(url.protocol)) referrer = url.origin; } catch {}
    const { error } = await createAdminClient().rpc("record_link_click", {
      p_event_id: parsed.data.event_id, p_card_id: found.card.id,
      p_link_id: link.id, p_link_label: link.label, p_link_url: link.href,
      p_source: linkClickSource(parsed.data.source),
      p_visitor_hash: hash(`${network}:${agent}:${parsed.data.visitor_id ?? ""}`),
      p_user_agent: agent || null, p_referrer: referrer,
    });
    if (error) { console.error("Link click persistence failed", error.code); return new NextResponse(null, { status: 503 }); }
    return empty();
  } catch { return new NextResponse(null, { status: 503 }); }
}
