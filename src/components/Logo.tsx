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
      <path d="M8 11h15v4h-5v14h-5V15H8z" fill="url(#lg)" />
      <path d="M23 18v11h4v-4l4 4h5l-7-7 6-6h-5l-3 3v-8h-4z" fill="#8fb3ff" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-bold tracking-tight text-ink" aria-label="TapSynk home">
      <LogoMark />
      <span className="text-lg">TapSynk</span>
    </Link>
  );
}
