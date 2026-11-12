export type OwnerNotification = {
  id: string; kind: "lead" | "appointment"; company_id: string | null;
  title: string; body: string; href: string; created_at: string; read_at: string | null;
  email_status: "pending" | "sending" | "sent" | "failed" | "uncertain";
};
export type NotificationSnapshot = {
  items: OwnerNotification[];
  counts: { leads: number; appointments: number; companyLeads: number; total: number };
  available: boolean;
};
export const emptyNotifications: NotificationSnapshot = { items: [], counts: { leads: 0, appointments: 0, companyLeads: 0, total: 0 }, available: true };
export function notificationHref(value: string) {
  return ["/dashboard/leads", "/dashboard/company/leads", "/dashboard/appointments"].includes(value) ? value : "/dashboard";
}
export function newNotificationItems(previous: Set<string>, items: OwnerNotification[]) {
  const fresh = items.filter(item => !previous.has(item.id) && !item.read_at);
  for (const item of items) previous.add(item.id);
  return fresh.reverse();
}
