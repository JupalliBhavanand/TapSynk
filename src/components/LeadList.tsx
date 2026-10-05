import { Mail, Phone } from "lucide-react";
import { LeadStatus } from "@/app/dashboard/leads/LeadStatus";
import type { Lead } from "@/lib/types";

export function LeadList({ leads, empty, cardNames }: { leads: Lead[]; empty: string; cardNames?: Record<string, string> }) {
  if (leads.length === 0) return <div className="card-surface mt-8 p-10 text-center text-sm text-muted">{empty}</div>;
  return (
    <ul className="card-surface mt-8 divide-y divide-line">
      {leads.map((l) => (
        <li key={l.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold">{l.name}{l.company && <span className="font-normal text-muted"> · {l.company}</span>}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
              {l.email && <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1.5 hover:text-brand"><Mail className="h-3.5 w-3.5" /> {l.email}</a>}
              {l.phone && <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-brand"><Phone className="h-3.5 w-3.5" /> {l.phone}</a>}
            </div>
            {l.message && <p className="mt-2 text-sm text-muted">“{l.message}”</p>}
            <p className="mt-2 text-xs text-muted">
              {new Date(l.created_at).toLocaleString()}
              {cardNames?.[l.card_id] && <> · via {cardNames[l.card_id]}'s card</>}
            </p>
          </div>
          <LeadStatus id={l.id} status={l.status} />
        </li>
      ))}
    </ul>
  );
}
