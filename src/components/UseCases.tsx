"use client";

import { useState } from "react";
import { Bot, Briefcase, Home, Scissors, Users, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

const CASES = [
  {
    key: "realtors",
    label: "Real estate",
    icon: Home,
    pitch: "Hand your card at an open house and let the AI handle the follow-up questions.",
    chat: ["Is the 3-bed on Oak Street still available?", "Yes! It's listed at $485k with an open house on Saturday. Want me to book you a private viewing instead?"],
    wins: ["Answers listing questions 24/7", "Books viewings into your calendar", "Captures every buyer as a lead"],
  },
  {
    key: "consultants",
    label: "Consultants",
    icon: Briefcase,
    pitch: "Turn a handshake at an event into a booked discovery call before you've left the room.",
    chat: ["Do you help with SaaS pricing strategy?", "Absolutely, that's one of our core services. I can book you a free 20-minute discovery call. Thursday at 10:00?"],
    wins: ["Explains your services clearly", "Qualifies people before the call", "Books discovery calls for you"],
  },
  {
    key: "salons",
    label: "Salons & clinics",
    icon: Scissors,
    pitch: "Clients tap your card at the desk to save you and rebook without calling.",
    chat: ["How much is a balayage?", "Balayage starts at $180 and takes about 3 hours. I have Friday at 1:00 pm open. Shall I book it?"],
    wins: ["Shares prices and opening hours", "Fills empty appointment slots", "Fewer phone calls at the desk"],
  },
  {
    key: "restaurants",
    label: "Restaurants",
    icon: UtensilsCrossed,
    pitch: "Put a tap card on every table for menus, reviews and bookings.",
    chat: ["Do you have vegan options?", "Yes! Our menu has 6 vegan dishes, including the mushroom risotto. Would you like to reserve a table?"],
    wins: ["Answers menu and allergy questions", "Takes table reservations", "Grows your guest list"],
  },
  {
    key: "teams",
    label: "Sales teams",
    icon: Users,
    pitch: "Give every rep a branded card and see which one brings in the most leads.",
    chat: ["Can someone walk me through enterprise pricing?", "Of course. I'll book you with Sam from our team. Is Tuesday at 2:00 pm good for a quick call?"],
    wins: ["Same branding on every card", "Leaderboard of top performers", "One bill with a team discount"],
  },
];

export function UseCases() {
  const [active, setActive] = useState(CASES[0]!.key);
  const c = CASES.find((x) => x.key === active)!;
  return (
    <div>
      <div role="tablist" aria-label="Industries" className="-mx-1 flex justify-start gap-2 overflow-x-auto px-1 pb-2 md:justify-center">
        {CASES.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={x.key === active}
            onClick={() => setActive(x.key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
              x.key === active ? "border-navy bg-navy text-white shadow" : "border-line bg-white text-ink-2 hover:text-ink",
            )}
          >
            <x.icon className="h-4 w-4" /> {x.label}
          </button>
        ))}
      </div>
      <div key={c.key} role="tabpanel" className="fade-up mt-8 grid items-center gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">{c.pitch}</h3>
          <ul className="mt-6 space-y-3">
            {c.wins.map((w) => (
              <li key={w} className="flex items-center gap-3 text-ink-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-success/10 text-xs font-bold text-success">✓</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
        <div className="card-surface mx-auto w-full max-w-md p-5">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-white"><Bot className="h-4 w-4" /></span>
            <span className="text-sm font-semibold">AI assistant</span>
            <span className="ml-auto flex items-center gap-1 text-xs text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" /> online</span>
          </div>
          <p className="ml-auto mt-4 w-4/5 rounded-2xl rounded-tr-sm bg-brand px-3.5 py-2.5 text-sm text-white">{c.chat[0]}</p>
          <p className="mt-3 w-[88%] rounded-2xl rounded-tl-sm bg-bg px-3.5 py-2.5 text-sm text-ink-2">{c.chat[1]}</p>
        </div>
      </div>
    </div>
  );
}
