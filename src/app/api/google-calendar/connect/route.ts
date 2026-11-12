import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { CALENDAR_SCOPE, GOOGLE_IDENTITY_SCOPE, calendarConfigured, calendarRedirectUri } from "@/lib/google-calendar";
import { SITE_URL } from "@/lib/env";

export async function GET() {
  const { user } = await getUser();
  if (!user) return NextResponse.redirect(`${SITE_URL}/login?next=/dashboard/appointments`);
  if (!calendarConfigured()) return NextResponse.redirect(`${SITE_URL}/dashboard/appointments?calendar=setup`);
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: calendarRedirectUri(), response_type: "code", scope: `${CALENDAR_SCOPE} ${GOOGLE_IDENTITY_SCOPE}`, access_type: "offline", prompt: "consent", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set("tapsynk_calendar_oauth", JSON.stringify({ state, verifier, userId: user.id }), { httpOnly: true, secure: SITE_URL.startsWith("https:"), sameSite: "lax", maxAge: 600, path: "/api/google-calendar/callback" });
  return response;
}
