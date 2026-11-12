import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { notificationSnapshot } from "@/lib/notifications";
import { sendOwnerNotificationEmail, sendPendingOwnerNotifications } from "@/lib/notification-mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/env";

export const maxDuration = 60;
export async function GET() {
  const { user } = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!(await rateLimit(`notifications:read:${user.id}`, 120, 60))) return NextResponse.json({ error: "Please wait a moment." }, { status: 429 });
  after(async () => { await sendPendingOwnerNotifications(user.id); });
  return NextResponse.json(await notificationSnapshot(user.id), { headers: { "Cache-Control": "no-store" } });
}
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), id: z.string().uuid() }),
  z.object({ action: z.literal("read_all") }),
  z.object({ action: z.literal("retry_email"), id: z.string().uuid(), acknowledgeUncertain: z.boolean().optional() }),
]);
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(SITE_URL).origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!(await rateLimit(`notifications:write:${user.id}`, 60, 60))) return NextResponse.json({ error: "Please wait a moment." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification." }, { status: 400 });
  const input = parsed.data;
  if (input.action === "retry_email") {
    const { data } = await supabase.from("notifications").select("id,email_status").eq("id", input.id).eq("owner_id", user.id).maybeSingle();
    if (!data || !["failed", "uncertain"].includes(data.email_status)) return NextResponse.json({ error: "This email cannot be retried." }, { status: 400 });
    if (data.email_status === "uncertain" && !input.acknowledgeUncertain) return NextResponse.json({ error: "Check your inbox before retrying an unconfirmed email." }, { status: 409 });
    const { error } = await createAdminClient().from("notifications").update({ email_status: "pending", email_error: null }).eq("id", input.id).eq("owner_id", user.id).eq("email_status", data.email_status);
    if (error) return NextResponse.json({ error: "Could not queue email." }, { status: 500 });
    after(async () => { await sendOwnerNotificationEmail(input.id); });
  } else {
    let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("owner_id", user.id).is("read_at", null);
    if (input.action === "read") query = query.eq("id", input.id);
    const { error } = await query;
    if (error) return NextResponse.json({ error: "Could not mark notifications read." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
