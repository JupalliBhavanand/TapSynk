import { Bot, CalendarCheck, UserPlus } from "lucide-react";
import { PhysicalCard } from "@/components/PhysicalCard";
import { AI_BUTTON } from "@/lib/greeting";

/** Phone + smart card tapping loop for the hero. Pure CSS animation. */
export function HeroDemo() {
  return (
    <div className="relative mx-auto h-[520px] w-full max-w-[460px]" aria-hidden="true">
      {/* phone */}
      <div className="absolute left-1/2 top-4 h-[480px] w-[240px] -translate-x-1/2 rounded-[42px] border-[10px] border-navy bg-white shadow-[0_40px_80px_-30px_rgba(15,20,38,0.6)]">
        <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-navy" />
        <div className="flex h-full flex-col overflow-hidden rounded-[32px] bg-bg px-4 pt-10">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-2 to-brand text-center text-2xl font-bold leading-[4rem] text-white">AM</div>
          <p className="mt-3 text-center text-sm font-bold">Alex Morgan</p>
          <p className="text-center text-[11px] text-muted">Founder · Northwind Studio</p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-navy py-2.5 text-[11px] font-semibold text-white">
              <UserPlus className="h-3.5 w-3.5" /> Save contact
            </div>
            <div className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-2 py-2.5 text-[11px] font-semibold text-white">
              <Bot className="h-3.5 w-3.5" /> {AI_BUTTON}
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-[10px] shadow-sm">Hi! I'm Alex's AI assistant. Want to see our packages or book a call?</div>
            <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-[10px] text-white">Book a call Friday</div>
            <div className="flex max-w-[85%] items-center gap-1.5 rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-[10px] shadow-sm">
              <CalendarCheck className="h-3.5 w-3.5 text-success" /> Booked: Fri 10:30 AM ✓
            </div>
          </div>
        </div>
        {/* smart waves */}
        <div className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2">
          {[0, 0.7, 1.4].map((d) => (
            <span key={d} className="ripple absolute -left-16 -top-16 h-32 w-32 rounded-full border-2 border-brand/50" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
      {/* card tapping the phone */}
      <div className="tap absolute -right-2 bottom-10 w-[230px] [container-type:inline-size]">
        <PhysicalCard card={{ full_name: "Alex Morgan", job_title: "Founder", company: "Northwind Studio", accent: "#1d5bff", ai: true }} />
      </div>
    </div>
  );
}
