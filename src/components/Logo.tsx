import Link from "next/link";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f8bff" />
          <stop offset="1" stopColor="#1d5bff" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="#0f1426" />
      <path d="M12 13h16v4h-6v12h-4V17h-6z" fill="url(#lg)" />
      <path d="M27 21a6 6 0 0 1 0 8M30 18.5a10 10 0 0 1 0 13" stroke="#8fb3ff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-bold tracking-tight text-ink" aria-label="TapSync home">
      <LogoMark />
      <span className="text-lg">TapSync</span>
    </Link>
  );
}
