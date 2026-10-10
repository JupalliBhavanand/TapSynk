"use client";
import { useState, useTransition } from "react";
import { convertBookingsToEnglish } from "./actions";

export function BookingLanguageButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return <div className="mb-5 text-sm">
    <button disabled={pending} onClick={() => start(async () => { const result = await convertBookingsToEnglish(); setMessage(result.error || result.message || ""); })} className="rounded-xl border border-line bg-white px-4 py-2 font-semibold disabled:opacity-50">{pending ? "Converting bookings…" : "Convert existing bookings to English"}</button>
    {message && <p role="status" className="mt-2 text-muted">{message}</p>}
  </div>;
}
