import { getDashboardData } from "@/lib/data";
import { SITE_URL } from "@/lib/env";
import { isActive } from "@/lib/types";
import { CardEditor } from "./CardEditor";

export default async function CardPage() {
  const data = (await getDashboardData())!;
  return (
    <div className="fade-up mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight">{data.card ? "Edit your card" : "Create your card"}</h1>
      <p className="mb-8 mt-1 text-muted">Everything updates live on your NFC card the moment you save.</p>
      <CardEditor
        initial={data.card}
        userId={data.user.id}
        defaultName={data.name}
        siteUrl={SITE_URL}
        aiPlan={isActive(data.subscription) && data.subscription?.tier === "ai"}
      />
    </div>
  );
}
