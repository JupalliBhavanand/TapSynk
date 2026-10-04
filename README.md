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
| Database schema, row-level security, storage bucket | `supabase/migrations/0001_init.sql` |
| **All prices** | `src/lib/plans.ts` (one file) |

Plans: **Virtual Card** $20/month · $49/3 months · $149/year, **AI Card** $49/month · $119/3 months · $399/year. Every plan includes a physical NFC card shipped to the address entered at checkout.

## Setup (about 15 minutes)

1. **Install**: `npm install`, then `cp .env.example .env.local`.
2. **Supabase**: create a project at supabase.com.
   - SQL Editor → paste and run `supabase/migrations/0001_init.sql`.
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

Each paid checkout creates a row in `orders` with the shipping name and address. Update `fulfillment_status` (`processing` → `printing` → `shipped` → `delivered`) in the Supabase table editor and customers see it on their billing page. Program each NFC chip with the card URL `https://YOUR-DOMAIN/c/<slug>`.
