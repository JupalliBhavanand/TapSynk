import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="grid-bg grid min-h-dvh place-items-center px-6 text-center">
      <div className="fade-up">
        <LogoMark className="mx-auto h-12 w-12" />
        <h1 className="mt-6 text-4xl font-bold tracking-tight">This card isn't here</h1>
        <p className="mt-2 text-muted">The link may be mistyped, or the card isn't live yet.</p>
        <Link href="/" className="btn btn-primary mt-8">Go to TapSync</Link>
      </div>
    </main>
  );
}
