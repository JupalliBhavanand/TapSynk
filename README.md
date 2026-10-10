# TapSynk — AI-powered smart business cards

Tap a TapSynk card on any phone → a digital business card opens → visitors **save the contact** in one tap or tap **Ask my AI anything**: an AI marketing agent that greets them out loud, talks and listens in any language, answers questions and **books appointments**.

Built with **Next.js 16 (App Router) · Supabase (auth, Postgres, storage) · Stripe (subscriptions + shipping) · Google Gemini (AI agent and voice)** and deployable to Vercel.

## What's inside

| Area | Where |
| --- | --- |
| Landing page, pricing, FAQ, SEO (metadata, JSON-LD, sitemap, robots, OG image) | `src/app/(marketing)`, `src/app/sitemap.ts` |
| Sign up / sign in / password reset (Supabase Auth) | `src/app/(auth)` |
| Dashboard: overview, stats, QR code, setup checklist | `src/app/dashboard/page.tsx` |
| Card editor with live preview + **first-time card print animation** | `src/app/dashboard/card`, `src/components/CardPrinter.tsx` |
| AI agent setup: **learn from website**, manual info, booking hours, test chat | `src/app/dashboard/ai`, `src/app/api/ai/learn` |
| Appointments booked by the AI | `src/app/dashboard/appointments` |
| Plans, Stripe Checkout with **shipping address**, billing portal, upgrades | `src/app/dashboard/billing`, `src/app/api/stripe/*` |
| **Receipt print animation** for every payment (print, PAID stamp, tear, re-print) | `src/components/ReceiptPrinter.tsx` |
| Public tap page `/c/your-name`: Save contact (vCard), Ask my AI anything, Share | `src/app/c/[slug]`, `src/app/api/vcard`, `src/app/api/chat` |
| **AI voice**: spoken greeting in the visitor's language, voice messages and hands-free voice chat in any language (Gemini speech) | `src/lib/speech.ts`, `src/lib/gemini.ts`, `src/app/api/chat/[slug]/greeting`, `src/app/api/chat/[slug]/speak` |
| **Leads** (visitors share their details back), CSV export | `src/app/dashboard/leads`, `src/app/api/leads` |
| **Analytics**: daily views, saves, AI chats, leads, bookings, tap vs QR vs link | `src/app/dashboard/analytics` |
| **Plan switching**: Virtual ↔ AI any time (upgrade now with proration, downgrade at period end) | `src/app/api/stripe/checkout`, `src/lib/billing.ts` |
| **AI lock**: AI agent and voice, the card's AI button, website learning and AI bookings only on AI plans | `src/lib/types.ts` (`hasAi`), `src/components/AiLocked.tsx` |
| **Book a demo** page (stored in `demo_requests`) and admin list at `/dashboard/demos` | `src/app/(marketing)/demo`, `src/app/api/demo`, `src/app/dashboard/demos` |
| **Company plans**: team cards, shared branding and AI agent, per-employee analytics, one monthly bill | `src/app/dashboard/company`, `src/app/api/stripe/company-checkout` |
| Database schema, row-level security, storage bucket | `supabase/migrations/0001_init.sql`, `0002_trial_leads_companies.sql`, `0003_plan_switch_demos_lead_notes.sql`, `0004_ai_voice.sql` |
| **All prices** | `src/lib/plans.ts` (one file) |

Plans: **Virtual Card** $20/month · $49/3 months · $149/year, **AI Card** $49/month · $119/3 months · $399/year. Every plan includes a physical NFC card shipped to the address entered at checkout.

**First month free on the Virtual Card**: an account's first Virtual Card plan starts with a 30-day trial ($0 today, card required). AI Card plans are charged from day one, and upgrading from a Virtual trial to AI ends the trial and charges AI right away. Stripe charges the chosen plan when the trial ends; if no payment method is on file the subscription cancels. One free month per account (`profiles.trial_used_at`).

**Company plans** (monthly only, no free month): $20 (Virtual) or $49 (AI) per employee card, 2 to 500 cards, with a team discount of 10% for 2–9 cards, 15% for 10–24 and 20% for 25+. Change the numbers in `COMPANY_DISCOUNTS` in `src/lib/plans.ts`. Seat changes are prorated on the next bill.

## Setup (about 15 minutes)

1. **Install**: `npm install`, then `cp .env.example .env.local`.
2. **Supabase**: create a project at supabase.com.
   - SQL Editor → paste and run `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_trial_leads_companies.sql`, then `supabase/migrations/0003_plan_switch_demos_lead_notes.sql`, then `supabase/migrations/0004_ai_voice.sql` (each file is safe to run again; on an existing database run only the ones you haven't run yet).
   - Project Settings → API → copy the URL, `anon` key and `service_role` key into `.env.local`.
   - Authentication → URL Configuration → set Site URL to your domain and add `https://YOUR-DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback`) to Redirect URLs.
3. **Stripe**: copy your secret key. No products to create: TapSynk creates `tapsync_virtual` and `tapsync_ai` products on first checkout, with prices from `src/lib/plans.ts`.
   - Developers → Webhooks → add endpoint `https://YOUR-DOMAIN/api/stripe/webhook` with events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
   - Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
   - Settings → Billing → Customer portal: turn it on so customers can update cards and cancel.
   - No extra webhook events are needed for plan switches: AI → Virtual switches use a Stripe subscription schedule, and `customer.subscription.updated` keeps the database in step.
4. **Admin**: set `ADMIN_EMAILS=you@example.com` (comma-separated) to see website demo requests at `/dashboard/demos`.
5. **Gemini**: create an API key at aistudio.google.com → API keys → `GEMINI_API_KEY`. It powers the chat, bookings, website learning, voice listening and the AI's voice. Optional: `GEMINI_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_VOICE` (default voice `Kore`). Turn on billing for the key before launch: the free tier has low limits.
6. **Run**: `npm run dev` → http://localhost:3000. Test card: `4242 4242 4242 4242`.
7. **Deploy**: push to GitHub, import in Vercel, add the same environment variables, set `NEXT_PUBLIC_SITE_URL` to your domain.

## Security

- Supabase row-level security on every table: users only ever read/write their own rows; billing rows are written only by the verified Stripe webhook.
- Auth session refreshed in `src/proxy.ts`; `/dashboard` is protected server-side.
- All inputs validated with zod; open-redirect-safe login redirects; honeypot on sign-up.
- Postgres-backed rate limiting on login, sign-up, checkout, AI chat, bookings and website learning.
- Website learning blocks private/internal addresses (SSRF protection), caps size, redirects and time.
- The AI can only book slots that are actually free (re-validated server-side) and double booking is blocked by a unique index.
- Strict security headers: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- Stripe webhook signatures verified; card numbers never touch the server.
- The voice endpoint only reads out replies the AI actually wrote (each carries a signed token), so it can't be used as free text-to-speech on your Gemini bill; greetings are generated once per card and language, then cached.

## Launch checklist

1. Run migrations 0001–0006 in the Supabase SQL editor (0004 adds cached greetings; 0005 adds appointment email status; 0006 tracks payment email delivery).
2. In Vercel, add every variable from `.env.example`, including `GEMINI_API_KEY` and `ADMIN_EMAILS`, and set `NEXT_PUBLIC_SITE_URL` to your real domain (https).
3. Set `NEXT_PUBLIC_REQUIRE_SUBSCRIPTION=true` for launch.
4. Switch Stripe to live keys, recreate the webhook in live mode and paste its new signing secret.
5. Supabase → Authentication → URL Configuration: add the live domain and `/auth/callback`.
6. Make a real AI Card, open it on your phone, and check the greeting, the mic and voice chat (the mic needs https).
7. Order your own card with a real payment, refund it in Stripe, and check the order appears in `orders`.

## Fulfilment

Each paid checkout creates a row in `orders` with the shipping name and address. Update `fulfillment_status` (`processing` → `printing` → `shipped` → `delivered`) in the Supabase table editor and customers see it on their billing page. Program each NFC chip with the card URL `https://YOUR-DOMAIN/c/<slug>?s=t` (the `?s=t` marks the visit as a tap in analytics; the dashboard QR code uses `?s=q`). Company orders carry `company_id` and `quantity`, so ship that many cards.


### English bookings and Gmail appointment confirmations

Apply `supabase/migrations/0005_appointment_confirmation.sql` before deploying this version. New appointments save customer names in English letters and meeting notes in English, while the voice conversation stays in the visitor's language. Use **Convert existing bookings to English** on the Appointments page for older records (20 per batch, safe to repeat). Dates, email addresses and phone numbers are preserved. Name transliterations may need review against the customer's preferred spelling.

Set these server-only environment variables locally and on your hosting provider:

```text
GMAIL_USER=your-sender@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
```

Enable Google 2-Step Verification and generate an app password at https://myaccount.google.com/apppasswords. Do not use your normal Gmail password. See https://support.google.com/accounts/answer/185833 for availability. The sender is your configured Gmail account, labeled TapSynk Appointments. Customer replies go to the business email on their card.

After a successful booking, the server sends an English **Appointment confirmation** email containing the customer name, business, host, appointment date, time, timezone, duration and notes. Email runs after the chat response so Gmail latency does not delay the reply. The appointment remains confirmed if email fails. Delivery status and Send confirmation / Retry email controls appear in Appointments. Gmail acceptance is tracked as sent; inbox delivery is not guaranteed. Concurrent sends are claimed atomically to avoid duplicate messages. Before retrying a failed send, check Gmail Sent because an SMTP connection can fail after acceptance. Historical appointments are not automatically emailed; use Send confirmation for those you want to notify.

Voice uses one configured `GEMINI_VOICE` and shared fixed delivery style for greetings and replies, with a stable decoding seed. Native pronunciation is preserved. Generative speech can still vary slightly across languages; this is not a cloned or acoustically locked voice. Calls automatically reopen the microphone after successful playback, stop after silence, and support tap-to-interrupt. Response and playback deadlines recover stalled requests. Verify microphone behavior and end-to-end latency on actual iPhone and Android devices before launch.


### Shared company sender for every customer's bookings

Configure one company email account on the platform server. Every card uses the same sender automatically after a successful booking; neither visitors nor card owners need to connect an email account or log in to email. Replies still go to the individual business email on the card. Set these server-only variables:

```text
COMPANY_EMAIL=appointments@your-company.com
COMPANY_EMAIL_NAME=TapSynk Appointments
SMTP_HOST=your-provider-smtp-host
SMTP_PORT=587
SMTP_AUTH_MODE=credentials
SMTP_USER=your-company-smtp-account
SMTP_PASSWORD=your-provider-smtp-password
```

Use your provider's actual SMTP hostname and authorized sender. Port 465 uses implicit TLS; other ports require STARTTLS. SMTP credentials authenticate the platform once, never individual users. If your company has an SMTP relay that authorizes the deployment server/IP, set `SMTP_AUTH_MODE=relay` and leave `SMTP_USER` and `SMTP_PASSWORD` empty. This omits SMTP authentication but still requires relay authorization and TLS. Simply changing the sender address does not authorize sending from its domain. See https://nodemailer.com/smtp for transport options.

Company settings take precedence over legacy `GMAIL_USER` / `GMAIL_APP_PASSWORD`. If no company sender or SMTP host is set, the existing Gmail configuration remains supported. Google Workspace using `smtp.gmail.com` still requires a valid Google app password in `SMTP_PASSWORD`; arbitrary company addresses cannot bypass Google authentication. Restart local Next.js or redeploy after configuring the shared sender.


### Conversation handoffs

During an active voice call, the microphone stays open between turns for quicker handoffs, but the recording processor disconnects while the AI speaks. The call indicator remains visible; ending the call or unmounting the chat stops microphone tracks. Quiet pauses keep the call listening without sending empty requests. Existing noise calibration is reused within a call so brief immediate answers can be captured. Push-to-talk releases the microphone after each recording.

End-of-turn silence is adaptive: 650 ms for short acknowledgements, 1 second for medium answers, and 1.2 seconds for longer speech. A 300 ms lead-in protects the start of words. Voice-enabled chat responses start preparing reply audio on the server before the client requests playback. An in-process cache shares pending and finished audio for up to 2 minutes, bounded to 16 entries and 2 MB per retained clip; failed generation can be retried. Instances that do not share a process render on demand. Text responses never wait for audio preparation, and text-only conversations do not pre-generate audio. This optimization reduces avoidable waiting; actual speech latency still depends on the provider, phone and connection.

Run `node scripts/test-smooth-voice.mjs` for microphone lifecycle, calibration, adaptive pauses and early-audio cache regression tests.

### Payment confirmations with attached bills

Apply `supabase/migrations/0006_payment_confirmation.sql` and enable **invoice.paid** on the Stripe webhook endpoint for `/api/stripe/webhook` (in both test and live mode as needed). Deploy the updated code with the same shared SMTP/Gmail sender used for appointment confirmations. No customer email login is required.

Paid invoices automatically email Stripe's recorded customer email address with an English payment confirmation and attached Stripe invoice PDF. If Stripe has no PDF, a printable HTML bill is attached instead. This covers initial subscription payments, renewals and paid upgrades; unpaid and zero-value invoices are skipped. The official bill links are included in the message. See https://docs.stripe.com/api/invoices and https://docs.stripe.com/api/events for invoice fields and event setup.

A service-only delivery table claims each invoice so concurrent and replayed webhooks do not send another accepted email. SMTP failure returns a webhook error for Stripe to retry without changing the payment or subscription. SMTP acceptance is not proof of inbox delivery. If a process crashes during sending, or the sender accepts the message but the database status cannot be saved, the record can remain `sending`; check the sender's Sent folder before marking it `sent` or resetting it to `pending`. A network disconnect after SMTP acceptance can still cause duplicate delivery on a retry. No historical payments are emailed automatically by the migration. Run `node scripts/test-payment-mail.mjs` for regression checks; real payment and inbox delivery were not exercised by these mocks.

### Streaming speech and readiness checks

Replies now stream 24 kHz PCM directly into Web Audio rather than waiting for a complete audio download. Greetings and replies share the same configured voice and delivery instructions. The default speech model is `gemini-3.8-flash-lite-tts`; an explicit `GEMINI_TTS_MODEL` overrides it. Cached replays use WAV audio. Playback cancellation stops queued audio, and the microphone resumes after actual playback ends.

Run `npm test`, `npm run lint`, and `npm run build` before deployment. `node --env-file=.env scripts/smoke-website.mjs` checks a production server at port 3100 in desktop and mobile Edge; it requires Playwright (override `PLAYWRIGHT_PATH` on another machine). `node --env-file=.env scripts/benchmark-ai-voice.mjs --live` makes billable speech requests and writes first-audio timing measurements. Provider timing excludes transcription, reply generation, network playback and device delays. Actual iPhone/Android microphone and multilingual pronunciation still need device verification.
