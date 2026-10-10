# TapSynk readiness checks — October 9, 2026

Speech replies stream 24 kHz PCM into Web Audio as chunks arrive. The default TTS model is Gemini 3.8 Flash Lite TTS, using the same configured voice and shared style as greetings. Pending audio generation is shared with the chat prewarm cache. Playback stops on interruption and microphone handoff waits for playback completion. Authentication redirect normalization and mobile homepage decorative overflow were also fixed.

Passed: production build of all routes, TypeScript, source/script ESLint, six regression suites (`npm test`), and 32 production-browser checks on desktop/mobile Edge. Browser checks cover ten public pages including the owner's published card, four protected dashboard redirects, signup validation, and seven API validation/access checks. No runtime page errors or page-width overflow were detected in these checked pages. Authenticated dashboard interactions and actual payments were not exercised.

Live speech-provider sample: Flash returned first audio in 1,485 ms and finished in 2,273 ms; Flash Lite returned first audio in 1,226 ms and finished in 1,876 ms. This is one short English sample per model, not an end-to-end response-time guarantee. Transcription and reply generation add time. See `voice-latency.json` and `website-smoke.json`.

Production dependency audit: zero vulnerabilities. Full dependency audit: five high findings in development tooling's braces dependency; no patched braces release was available, and the suggested Next ESLint downgrade is incompatible with the installed Next version. Do not apply an automatic forced downgrade.

Deployment gaps: configured site URL is local rather than HTTPS, Stripe is using test keys, and COMPANY_EMAIL/SMTP_HOST are absent. Legacy Gmail settings are present with an app password of the expected length, but successful authentication and email delivery were not verified during this check. Set the authorized shared company sender before relying on company-branded confirmations. Actual iPhone/Android microphone operation and native-language pronunciation require device checks. No production deployment was performed.
