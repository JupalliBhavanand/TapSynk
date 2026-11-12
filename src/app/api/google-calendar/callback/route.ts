import { timingSafeEqual } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCalendarToken } from "@/lib/calendar-tokens";
import { CALENDAR_SCOPE, calendarRedirectUri, syncUpcomingAppointments } from "@/lib/google-calendar";
import { SITE_URL } from "@/lib/env";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  function finish(status: string) {
    const response = NextResponse.redirect(`${SITE_URL}/dashboard/appointments?calendar=${status}`);
    response.cookies.set("tapsynk_calendar_oauth", "", { httpOnly: true, secure: SITE_URL.startsWith("https:"), sameSite: "lax", maxAge: 0, path: "/api/google-calendar/callback" });
    return response;
  }
  const { user } = await getUser();
  if (!user) return finish("signin");
  let saved: { state: string; verifier: string; userId: string };
  try { saved = JSON.parse(request.cookies.get("tapsynk_calendar_oauth")?.value || ""); } catch { return finish("expired"); }
  const state = request.nextUrl.searchParams.get("state") || "";
  if (!saved || typeof saved.state !== "string" || typeof saved.verifier !== "string" || saved.userId !== user.id || !/^[A-Za-z0-9_-]{43}$/.test(state) || !/^[A-Za-z0-9_-]{43}$/.test(saved.state) || state.length !== saved.state.length || !timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))) return finish("expired");
  if (request.nextUrl.searchParams.has("error")) return finish("denied");
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return finish("failed");
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", code, code_verifier: saved.verifier, redirect_uri: calendarRedirectUri(), grant_type: "authorization_code" }), signal: AbortSignal.timeout(10000), cache: "no-store" });
    const token = await response.json();
    if (!response.ok || !token.refresh_token || !token.scope?.split(" ").includes(CALENDAR_SCOPE)) return finish("failed");
    let googleEmail: string | null = null;
    try {
      const identity = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(5000), cache: "no-store" });
      if (identity.ok) { const profile = await identity.json(); if (typeof profile.email === "string" && profile.email.length <= 254) googleEmail = profile.email; }
    } catch { /* Calendar access works even when the optional account label is unavailable. */ }
    const db = createAdminClient();
    const { error } = await db.from("google_calendar_connections").upsert({ user_id: user.id, refresh_token_encrypted: encryptCalendarToken(token.refresh_token), granted_scope: token.scope, google_email: googleEmail, calendar_summary: googleEmail ? `${googleEmail} · Primary calendar` : "Primary calendar", last_error: null, updated_at: new Date().toISOString() });
    if (error) return finish("storage");
    await db.from("appointments").update({ calendar_sync_status: "pending", calendar_sync_error: null }).eq("owner_id", user.id).eq("status", "confirmed").gte("starts_at", new Date().toISOString());
    after(async () => { await syncUpcomingAppointments(user.id); });
    return finish("connected");
  } catch { return finish("failed"); }
}
