import { requireDashboardData } from "@/lib/data";
import { hasAi, isActive, type Appointment } from "@/lib/types";
import { AiLocked } from "@/components/AiLocked";
import { AppointmentsBoard } from "./AppointmentsBoard";

export default async function AppointmentsPage() {
  const { supabase, card, agent, subscription } = await requireDashboardData();
  const tz = agent?.timezone || "UTC";
  const { data } = card
    ? await supabase.from("appointments").select("*").eq("card_id", card.id).order("starts_at", { ascending: true }).limit(1000)
    : { data: [] };
  const all = (data ?? []) as Appointment[];
  const ai = hasAi(subscription);

  return (
    <div className="fade-up mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
      <p className="mb-8 mt-1 text-muted">Booked by your AI agent. Times shown in {tz.replace(/_/g, " ")}.</p>
      {!ai && all.length === 0 ? (
        <AiLocked title="Let your AI book meetings for you" upgradeInterval={isActive(subscription) && subscription?.stripe_subscription_id ? subscription.billing_interval : undefined} />
      ) : (
        <>
          {!ai && <p className="mb-6 rounded-xl border border-cream-line bg-cream px-4 py-3 text-sm">New bookings need the AI Card plan. Your past appointments are still here.</p>}
          <AppointmentsBoard items={all} tz={tz} />
        </>
      )}
    </div>
  );
}
