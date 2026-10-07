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

1. Run all four migrations in the Supabase SQL editor (0004 adds the `ai-voice` storage bucket for cached greetings).
2. In Vercel, add every variable from `.env.example`, including `GEMINI_API_KEY` and `ADMIN_EMAILS`, and set `NEXT_PUBLIC_SITE_URL` to your real domain (https).
3. Set `NEXT_PUBLIC_REQUIRE_SUBSCRIPTION=true` for launch.
4. Switch Stripe to live keys, recreate the webhook in live mode and paste its new signing secret.
5. Supabase → Authentication → URL Configuration: add the live domain and `/auth/callback`.
6. Make a real AI Card, open it on your phone, and check the greeting, the mic and voice chat (the mic needs https).
7. Order your own card with a real payment, refund it in Stripe, and check the order appears in `orders`.

## Fulfilment

Each paid checkout creates a row in `orders` with the shipping name and address. Update `fulfillment_status` (`processing` → `printing` → `shipped` → `delivered`) in the Supabase table editor and customers see it on their billing page. Program each NFC chip with the card URL `https://YOUR-DOMAIN/c/<slug>?s=t` (the `?s=t` marks the visit as a tap in analytics; the dashboard QR code uses `?s=q`). Company orders carry `company_id` and `quantity`, so ship that many cards.
