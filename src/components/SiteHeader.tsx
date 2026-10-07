import Link from "next/link";
import { Logo } from "@/components/Logo";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-bg/90 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-2 md:flex" aria-label="Main">
          <Link href="/#how" className="hover:text-ink">How it works</Link>
          <Link href="/#ai" className="hover:text-ink">AI agent</Link>
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/#faq" className="hover:text-ink">FAQ</Link>
          <Link href="/demo" className="hover:text-ink">Book a demo</Link>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/dashboard" className="btn btn-dark py-2">Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn hidden py-2 text-ink-2 hover:text-ink sm:inline-flex">Sign in</Link>
              <Link href="/signup" className="btn btn-primary py-2">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
