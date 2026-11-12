import { calendarConnectionStatus } from "@/lib/google-calendar";
import { GoogleWorkspaceButtons } from "@/components/GoogleWorkspaceButtons";
import { CalendarConnection } from "./CalendarConnection";
import { loadListRows } from "@/lib/list-data";
import { requireDashboardData } from "@/lib/data";
import { hasAi, isActive, type Appointment } from "@/lib/types";
import { AiLocked } from "@/components/AiLocked";
import { AppointmentsBoard } from "./AppointmentsBoard";
import { BookingLanguageButton } from "./BookingLanguageButton";

export const maxDuration = 60;

export default async function AppointmentsPage({ searchParams }: PageProps<"/dashboard/appointments">) {
  const sp = await searchParams;
  const { supabase, user, agent, subscription, company } = await requireDashboardData();
  const connection = await calendarConnectionStatus(user.id);
  const tz = agent?.timezone || "UTC";
  const all = await loadListRows<Appointment>((from, to) => supabase.from("appointments").select("*").eq("owner_id", user.id).order("starts_at").order("id").range(from, to));
  const ai = hasAi(subscription) || hasAi(company);

  return (
    <div className="fade-up mx-auto max-w-5xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">Appointments</h1><p className="mt-1 text-muted">Booked by your AI agent. Times shown in {tz.replace(/_/g, " ")}.</p></div><GoogleWorkspaceButtons email={connection.connected ? connection.googleEmail : user.email} /></div>
      <CalendarConnection {...connection} notice={typeof sp.calendar === "string" ? sp.calendar : undefined} />
      {!ai && all.length === 0 ? (
        <AiLocked title="Let your AI book meetings for you" upgradeInterval={isActive(subscription) && subscription?.stripe_subscription_id ? subscription.billing_interval : undefined} />
      ) : (
        <>
          {!ai && <p className="mb-6 rounded-xl border border-cream-line bg-cream px-4 py-3 text-sm">New bookings need the AI Card plan. Your past appointments are still here.</p>}
          {all.some((item) => item.booking_language !== "en") && <BookingLanguageButton />}
          <AppointmentsBoard calendarConnected={connection.connected && connection.configured} items={all} tz={tz} googleEmail={connection.connected ? connection.googleEmail : user.email} />
        </>
      )}
    </div>
  );
}
