import Link from "next/link";
import { ExternalLink, Pencil, Plus, Trophy } from "lucide-react";
import { emptyTotals } from "@/lib/analytics";
import { getCompanyTeam } from "@/lib/company";
import { COMPANY_MAX_SEATS, COMPANY_MIN_SEATS, isTier } from "@/lib/plans";
import { isActive } from "@/lib/types";
import { initials } from "@/lib/utils";
import { CompanySetup } from "./CompanySetup";
import { RemoveCard } from "./RemoveCard";

export default async function CompanyPage({ searchParams }: PageProps<"/dashboard/company">) {
  const sp = await searchParams;
  const { company, user, cards, perCard } = await getCompanyTeam();

  if (!company || !isActive(company)) {
    const seats = Number(sp.seats);
    return (
      <>
        {company && (
          <p className="mb-6 rounded-xl border border-cream-line bg-cream px-4 py-3 text-sm">
            Your company isn't active yet. Finish payment to start creating employee cards.
          </p>
        )}
        <CompanySetup
          initial={company}
          userId={user.id}
          defaultTier={isTier(sp.tier) ? sp.tier : "ai"}
          defaultSeats={seats >= COMPANY_MIN_SEATS && seats <= COMPANY_MAX_SEATS ? Math.round(seats) : 5}
        />
      </>
    );
  }

  const full = cards.length >= company.seats;
  const ranked = [...cards].sort((a, b) => (perCard[b.id]?.view ?? 0) - (perCard[a.id]?.view ?? 0));
  const topId = ranked[0] && (perCard[ranked[0].id]?.view ?? 0) > 0 ? ranked[0].id : null;

  return (
    <div className="space-y-8">
      <section className="card-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold">Employee cards</h2>
            <p className="text-sm text-muted">{cards.length} of {company.seats} cards used · numbers are the last 30 days</p>
          </div>
          {full ? (
            <Link href="/dashboard/company/billing" className="btn btn-dark text-sm"><Plus className="h-4 w-4" /> Add more seats</Link>
          ) : (
            <Link href="/dashboard/company/cards/new" className="btn btn-primary text-sm"><Plus className="h-4 w-4" /> Add employee card</Link>
          )}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg">
          <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${Math.min(100, (cards.length / company.seats) * 100)}%` }} />
        </div>

        {cards.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center">
            <p className="text-muted">No employee cards yet. Add your first team member.</p>
            <Link href="/dashboard/company/cards/new" className="btn btn-primary mt-4">Add employee card</Link>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted">
                  <th className="pb-3 font-semibold">Employee</th>
                  <th className="pb-3 text-right font-semibold">Views</th>
                  <th className="pb-3 text-right font-semibold">Saves</th>
                  <th className="pb-3 text-right font-semibold">Leads</th>
                  <th className="pb-3 text-right font-semibold">AI chats</th>
                  <th className="pb-3 text-right font-semibold">Bookings</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ranked.map((c) => {
                  const t = perCard[c.id] ?? emptyTotals();
                  return (
                    <tr key={c.id}>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          {c.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.avatar_url} alt="" className="h-9 w-9 rounded-xl object-cover" />
                          ) : (
                            <span className="grid h-9 w-9 place-items-center rounded-xl text-xs font-bold text-white" style={{ background: c.accent }}>{initials(c.full_name)}</span>
                          )}
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-semibold">
                              {c.full_name}
                              {c.id === topId && <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4d6] px-2 py-0.5 text-[10px] font-bold text-[#9a6b00]"><Trophy className="h-3 w-3" /> TOP</span>}
                              {!c.published && <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-bold text-muted">DRAFT</span>}
                            </p>
                            <p className="truncate text-xs text-muted">{c.job_title || "—"} · /c/{c.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right font-semibold tabular-nums">{t.view}</td>
                      <td className="py-3 text-right tabular-nums">{t.save}</td>
                      <td className="py-3 text-right tabular-nums">{t.lead}</td>
                      <td className="py-3 text-right tabular-nums">{t.ai}</td>
                      <td className="py-3 text-right tabular-nums">{t.booking}</td>
                      <td className="py-3">
                        <div className="flex justify-end gap-1">
                          <Link href={`/c/${c.slug}`} target="_blank" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink" aria-label={`Open ${c.full_name}'s card`}><ExternalLink className="h-4 w-4" /></Link>
                          <Link href={`/dashboard/company/cards/${c.id}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink" aria-label={`Edit ${c.full_name}'s card`}><Pencil className="h-4 w-4" /></Link>
                          <RemoveCard id={c.id} name={c.full_name} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CompanySetup initial={company} userId={user.id} profileOnly />
    </div>
  );
}
