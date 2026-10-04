"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { forgotPassword, login, signup, updatePassword, type AuthState } from "./actions";

function Notice({ state }: { state: AuthState }) {
  if (state?.error) return <p role="alert" className="rounded-xl border border-stamp/20 bg-stamp/5 px-3 py-2 text-sm text-stamp">{state.error}</p>;
  if (state?.message) return <p role="status" className="rounded-xl border border-success/20 bg-success/5 px-3 py-2 text-sm text-success">{state.message}</p>;
  return null;
}

function PasswordField({ autoComplete, label = "Password" }: { autoComplete: string; label?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor="password">{label}</label>
      <div className="relative">
        <input id="password" name="password" type={show ? "text" : "password"} required minLength={8} autoComplete={autoComplete} className="input pr-10" />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, action] = useActionState(login, linkError ? { error: "That link has expired. Please sign in or request a new one." } : undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/dashboard"} />
      <Notice state={state} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <PasswordField autoComplete="current-password" />
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="font-medium text-brand hover:underline">Forgot password?</Link>
      </div>
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/dashboard"} />
      {/* honeypot for bots */}
      <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <Notice state={state} />
      <div>
        <label className="label" htmlFor="fullName">Full name</label>
        <input id="fullName" name="fullName" required autoComplete="name" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <PasswordField autoComplete="new-password" />
      <p className="text-xs text-muted">At least 8 characters with a letter and a number.</p>
      <SubmitButton pendingText="Creating account…">Create free account</SubmitButton>
      <p className="text-center text-xs text-muted">
        By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(forgotPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <Notice state={state} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <Notice state={state} />
      <PasswordField autoComplete="new-password" label="New password" />
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
