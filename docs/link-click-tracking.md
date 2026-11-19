# Per-link click analytics

## Deployment

Apply `supabase/migrations/0010_link_clicks.sql` after the existing migrations using your normal Supabase migration process, then deploy the app. This change does not apply SQL to the hosted database automatically. No new environment variables are needed. Missing schema is reported as unavailable analytics, not fabricated zero totals.

## Behavior

- Published public profiles track website, phone, email, address/maps and all supported social links, including arbitrary destination URLs entered in those fields. There is no new custom-link editor or customer-feedback feature.
- Destinations stay direct anchors. Trusted primary clicks, keyboard activation and middle clicks enqueue a `sendBeacon`, with a keepalive-fetch fallback. Nothing waits for the tracker before navigating. Context-menu “open in new tab” is not observable and is not counted. Disabled JavaScript, blockers and delivery failures can also prevent counting.
- Owner previews and unpublished profiles do not attach active tracking. Profile analytics are never shown publicly.
- A click records a server timestamp, card ID, configured identifier/label/URL, source, bounded user agent, referrer origin and an HMAC visitor hash. Raw IP addresses and referrer paths/query strings are not stored. The browser visitor UUID lives in session storage; tracking still works if storage is disabled.
- `?s=t`/`tap`/`nfc` maps to `nfc`, `q`/`qr` to `qr`, `l`/`link` to `link`. Missing/unrecognized sources are `unknown`.
- Client suppression and a transactional PostgreSQL lock suppress the same visitor/link within two seconds. Event UUID uniqueness prevents retries from double-counting indefinitely. Obvious bot/prefetch requests are ignored and network rate limiting bounds basic abuse. This is best-effort analytics, not fraud-proof human verification.
- Dashboard → Analytics and Company → Analytics show every currently configured link, including zero-click entries. The section’s independent 7-day/30-day/all-time filter does not change the existing 30-day card-view charts. Percentages use current links only. A changed URL starts at zero for that destination; deleted destinations retain history but do not inflate current rows. Historical clicks before deployment cannot be recovered.
- Read queries use the authenticated Supabase client and a SECURITY INVOKER aggregate. RLS authorizes only the current card owner or the current company owner. Public/anonymous users cannot read totals or write events directly. Writes use the validated server endpoint and a service-role-only RPC.

## End-to-end checks

1. Run `npm run test:link-clicks`, `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
2. Configure a published, active card with Website, Instagram, LinkedIn and a custom URL in a supported link field. Note the initial counts at `/dashboard/analytics?links=30`.
3. Open `/c/YOUR-SLUG?s=t` in a separate signed-out/incognito browser. Click Website. The external URL must open directly with no analytics redirect. The Network panel should show `POST /api/clicks/YOUR-SLUG` returning 204. Confirm a `link_clicks` row with `source=nfc` in Supabase as an administrator.
4. Click another social link, then rapidly double-click the same link. Different links count independently, but the rapid duplicate adds only one click. Wait over two seconds and click again to count a deliberate new activation.
5. Refresh owner analytics. Verify all links remain visible, the counts/share/top link update, and 7/30/all filters work. Compare filters using test rows at different timestamps in a disposable test database.
6. Repeat with `?s=q`, `?s=l`, and no source. Check `qr`, `link` and `unknown`. Test middle click and keyboard Enter. Right-click menu opens and prefetches should not add events.
7. Open the card while signed in as its owner: preview clicks should not add events. Try a separate account’s dashboard/database client: it must not see these rows. Confirm the company owner can see their team’s rows and an unrelated company owner cannot.
8. Unpublish the card or remove/change its link. Direct tracking requests for that unpublished profile or an unconfigured identifier must fail; the new destination must not inherit old-URL totals. Disable tracking requests in DevTools and confirm every external link still opens.

Tests use in-memory PostgreSQL and mocked browser/provider boundaries. They never connect to hosted Supabase or modify customer data.
