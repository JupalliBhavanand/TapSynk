"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-muted">Please try again. If it keeps happening, <a href="mailto:hello@tapsync.app" className="text-brand underline">contact support</a>.</p>
        <button onClick={reset} className="btn btn-primary mt-6">Try again</button>
      </div>
    </main>
  );
}
