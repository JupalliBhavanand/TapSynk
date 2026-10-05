# TapSync — AI-powered NFC business cards

Tap a TapSync card on any phone → a digital business card opens → visitors **save the contact** in one tap or **Talk to AI**: an AI marketing agent that knows the business, answers questions and **books appointments**.

Built with **Next.js 16 (App Router) · Supabase (auth, Postgres, storage) · Stripe (subscriptions + shipping) · Claude (AI agent)** and deployable to Vercel.

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
| Public tap page `/c/your-name`: Save contact (vCard), Talk to AI, Share | `src/app/c/[slug]`, `src/app/api/vcard`, `src/app/api/chat` |
| **Leads** (visitors share their details back), CSV export | `src/app/dashboard/leads`, `src/app/api/leads` |
| **Analytics**: daily views, saves, AI chats, leads, bookings, tap vs QR vs link | `src/app/dashboard/analytics` |
| **Company plans**: team cards, shared branding and AI agent, per-employee analytics, one monthly bill | `src/app/dashboard/company`, `src/app/api/stripe/company-checkout` |
| Database schema, row-level security, storage bucket | `supabase/migrations/0001_init.sql`, `0002_trial_leads_companies.sql` |
| **All prices** | `src/lib/plans.ts` (one file) |

Plans: **Virtual Card** $20/month · $49/3 months · $149/year, **AI Card** $49/month · $119/3 months · $399/year. Every plan includes a physical NFC card shipped to the address entered at checkout.

**First month free**: each account's first personal plan starts with a 30-day trial ($0 today, card required). Stripe charges the chosen plan when the trial ends; if no payment method is on file the subscription cancels. One free month per account (`profiles.trial_used_at`).

**Company plans** (monthly only, no free month): $20 (Virtual) or $49 (AI) per employee card, 2 to 500 cards, with a team discount of 10% for 2–9 cards, 15% for 10–24 and 20% for 25+. Change the numbers in `COMPANY_DISCOUNTS` in `src/lib/plans.ts`. Seat changes are prorated on the next bill.

## Setup (about 15 minutes)

1. **Install**: `npm install`, then `cp .env.example .env.local`.
2. **Supabase**: create a project at supabase.com.
   - SQL Editor → paste and run `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_trial_leads_companies.sql` (already set up on v1? run only 0002).
   - Project Settings → API → copy the URL, `anon` key and `service_role` key into `.env.local`.
   - Authentication → URL Configuration → set Site URL to your domain and add `https://YOUR-DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback`) to Redirect URLs.
3. **Stripe**: copy your secret key. No products to create: TapSync creates `tapsync_virtual` and `tapsync_ai` products on first checkout, with prices from `src/lib/plans.ts`.
   - Developers → Webhooks → add endpoint `https://YOUR-DOMAIN/api/stripe/webhook` with events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
   - Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
   - Settings → Billing → Customer portal: turn it on so customers can update cards and cancel.
4. **Anthropic**: create an API key at console.anthropic.com → `ANTHROPIC_API_KEY`.
5. **Run**: `npm run dev` → http://localhost:3000. Test card: `4242 4242 4242 4242`.
6. **Deploy**: push to GitHub, import in Vercel, add the same environment variables, set `NEXT_PUBLIC_SITE_URL` to your domain.

## Security

- Supabase row-level security on every table: users only ever read/write their own rows; billing rows are written only by the verified Stripe webhook.
- Auth session refreshed in `src/proxy.ts`; `/dashboard` is protected server-side.
- All inputs validated with zod; open-redirect-safe login redirects; honeypot on sign-up.
- Postgres-backed rate limiting on login, sign-up, checkout, AI chat, bookings and website learning.
- Website learning blocks private/internal addresses (SSRF protection), caps size, redirects and time.
- The AI can only book slots that are actually free (re-validated server-side) and double booking is blocked by a unique index.
- Strict security headers: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- Stripe webhook signatures verified; card numbers never touch the server.

## Fulfilment

Each paid checkout creates a row in `orders` with the shipping name and address. Update `fulfillment_status` (`processing` → `printing` → `shipped` → `delivered`) in the Supabase table editor and customers see it on their billing page. Program each NFC chip with the card URL `https://YOUR-DOMAIN/c/<slug>?s=t` (the `?s=t` marks the visit as a tap in analytics; the dashboard QR code uses `?s=q`). Company orders carry `company_id` and `quantity`, so ship that many cards.
