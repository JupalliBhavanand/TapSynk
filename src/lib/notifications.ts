import "server-only";
import { createClient } from "@/lib/supabase/server";
import { emptyNotifications, type NotificationSnapshot, type OwnerNotification } from "@/lib/notification-types";

export async function notificationSnapshot(ownerId: string): Promise<NotificationSnapshot> {
  const db = await createClient();
  const [feed, leads, appointments, company] = await Promise.all([
    db.from("notifications").select("id,kind,company_id,title,body,href,created_at,read_at,email_status").eq("owner_id", ownerId).order("created_at", { ascending: false }).order("id").limit(30),
    db.from("notifications").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("kind", "lead").is("company_id", null).is("read_at", null),
    db.from("notifications").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("kind", "appointment").is("read_at", null),
    db.from("notifications").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("kind", "lead").not("company_id", "is", null).is("read_at", null),
  ]);
  if ([feed, leads, appointments, company].some(result => result.error)) return { ...emptyNotifications, available: false };
  const counts = { leads: leads.count || 0, appointments: appointments.count || 0, companyLeads: company.count || 0, total: 0 };
  counts.total = counts.leads + counts.appointments + counts.companyLeads;
  return { items: (feed.data || []) as OwnerNotification[], counts, available: true };
}
