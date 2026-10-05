import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import type { Lead } from "@/lib/types";

// Leading = + - @ would run as formulas in spreadsheet apps.
const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

/** CSV of the signed-in user's leads: ?scope=company for team leads, otherwise personal. */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const company = request.nextUrl.searchParams.get("scope") === "company";
  let query = supabase.from("leads").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(5000);
  query = company ? query.not("company_id", "is", null) : query.is("company_id", null);
  const { data } = await query;
  const leads = (data ?? []) as Lead[];

  let names: Record<string, string> = {};
  if (company && leads.length) {
    const { data: cards } = await supabase.from("cards").select("id, full_name").in("id", [...new Set(leads.map((l) => l.card_id))]);
    names = Object.fromEntries((cards ?? []).map((c) => [c.id as string, c.full_name as string]));
  }
  const header = ["Date", "Name", "Email", "Phone", "Company", "Note", "Status", ...(company ? ["Employee card"] : [])];
  const rows = leads.map((l) => [l.created_at, l.name, l.email, l.phone, l.company, l.message, l.status, ...(company ? [names[l.card_id] ?? ""] : [])]);
  const csv = [header, ...rows].map((r) => r.map((v) => cell(String(v ?? ""))).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="tapsync-${company ? "team-" : ""}leads.csv"`,
      "cache-control": "no-store",
    },
  });
}
