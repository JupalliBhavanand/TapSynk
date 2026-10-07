import { Logo } from "@/components/Logo";
import { PhysicalCard } from "@/components/PhysicalCard";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</main>
        <p className="text-xs text-muted">© {new Date().getFullYear()} TapSynk. Secured with encrypted sessions.</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-navy lg:block">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand/40 blur-3xl" />
        <div className="relative flex h-full flex-col justify-center px-16 text-white">
          <div className="float w-[22rem] [container-type:inline-size]">
            <PhysicalCard card={{ full_name: "Alex Morgan", job_title: "Founder", company: "Northwind Studio", accent: "#1d5bff", ai: true }} />
          </div>
          <h2 className="mt-12 max-w-md text-3xl font-bold leading-tight tracking-tight">
            One tap. Your card, your contact, and an AI that sells for you.
          </h2>
          <ul className="mt-8 space-y-4 text-white/80">
            <li className="flex items-center gap-3"><Zap className="h-5 w-5 text-brand-2" /> Set up your card in under 3 minutes</li>
            <li className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-brand-2" /> AI learns your business from your website</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-brand-2" /> Payments secured by Stripe</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
