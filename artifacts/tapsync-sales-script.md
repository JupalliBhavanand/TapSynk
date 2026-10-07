# TapSynk customer sales script

Prepared from the local website source on 7 October 2026. This covers the homepage, pricing, demo, signup, public card, individual and company dashboards, lead capture, AI setup, appointment management, analytics, billing, and policy pages. It is a source review; live payments, physical fulfilment and AI performance were not tested.

## What to sell

Lead with this: **“Keep the conversation going after the introduction.”** TapSynk combines an smart card and editable digital profile with contact sharing, voluntary lead capture and analytics. The paid AI Card adds a business assistant that answers from supplied business information and can book available appointments. Focus on consultants, real estate professionals, appointment businesses and sales teams.

## Opening: ask before pitching

“Hi, I’m [your name] from TapSynk. When you meet a potential customer, what happens next? Do they save your number, ask about your services, or book a call—or do you have to chase the conversation later?”

Listen. Then ask: “What takes more of your time: exchanging details, answering the same questions, or arranging appointments?”

## The pitch: about 45 seconds

“That’s exactly where TapSynk can help. You tap your card against a compatible phone, and your business profile opens—no app needed. They can save your contact, see your links, and choose to share their details back with you. You can update your profile without printing a new card.

“If you choose the AI Card, your business assistant can answer questions about your services using the information you provide, and help visitors book an available appointment while you’re busy. You see shared contacts and activity in your dashboard, so you have a clearer next step after each introduction.

“Let me show you what that would look like for your business.”

## Demonstrate, then connect it to their answer

1. Open a configured demonstration card with a tap or QR scan. Say: “This is what your customer sees.”
2. Ask them to save the demo contact: “Your details are now easy to find again.”
3. On an AI-enabled demo, ask one relevant services question: “We add your website and business information, then review what the assistant has learned.”
4. Show available slots and a test booking: “You choose your working hours and appointment length. Bookings appear in TapSynk.”
5. Show the lead form: “People choose to share their contact. Those details go into your dashboard for follow-up.”
6. Return to their problem: “You mentioned [their problem]. Which part of this would be most useful to you?”

Use a test account for demonstrations. Never present sample conversations or charts as customer results.

## Recommend the appropriate plan and close

“If your main need is sharing details and collecting contacts, the Virtual Card is a good starting point. It’s $0 for your first 30 days, then $20 per month on monthly billing. It includes your smart card and shipping to supported countries. It renews automatically unless you cancel.

“If answering questions and taking appointments is your priority, the AI Card is $49 per month on monthly billing. It includes the Virtual Card features plus the AI assistant, and billing starts from day one.

“Based on what you told me, I’d recommend [plan] because [their specific need]. Shall we set up your profile now, or book a free 15-minute demonstration for your business?”

For a customer who wants AI today: “Let’s create your account, add your business details, review the AI information and availability, and select the AI plan. You can review the price before completing checkout.”

## Common objections: responses to say out loud

**“I already have business cards.”**

“You already have a way to introduce yourself. TapSynk gives the person a profile they can save and revisit, and you can update it whenever your details change. The AI option adds answers and booking after you’ve left. Let’s see whether that next step is useful in your business.”

**“Why a subscription?”**

“The plan covers the ongoing digital profile, lead capture and analytics; the AI plan also covers the assistant and booking features. The physical card is included with a new subscription. If you only need basic contact sharing, I’d start with Virtual.”

**“It’s expensive.”**

“Let’s connect the price to how you would use it. How many new introductions do you make, and how much time do you spend on repeated questions or arranging calls? If those are occasional tasks, Virtual may be enough. If they happen every day, let’s test the AI workflow in a demo before you decide.”

**“Will the AI get things wrong?”**

“It uses the business information you supply. We review that information, test common questions, and keep prices and policies updated. AI can still make mistakes, so I wouldn’t promise perfect answers. Let’s test questions your customers actually ask.”

**“Do customers need an app?”**

“No. The profile opens in their browser on compatible smart phones, and the QR code gives them another way to open it.”

**“Will this guarantee more sales?”**

“I can’t guarantee sales. TapSynk helps people find your details, get answers and take a next step. Your offer and your follow-up still matter. The dashboard helps you see how people interact with the card.”

**“Can I get this for my team?”**

“Yes. You can have branded employee cards, team analytics and one monthly bill. Discounts are 10% for 2–9 cards, 15% for 10–24, and 20% for 25 or more. Company plans have no free trial. For example, ten AI cards are $416.50 per month in total at the current team pricing.”

**“I need to think about it.”**

“Of course. What would help you decide: seeing the AI answer your own business questions, understanding the price, or checking how you’d use it? We can focus a free demo on that.”

## Short follow-up message to send yourself

“Hi [name], you mentioned [specific problem]. With TapSynk, customers can save your business details with a tap, and the AI Card can answer service questions and help them book an appointment. Here’s the demo link: [your confirmed website URL]/demo. Would [day/time] suit a free 15-minute walkthrough?”

## Energetic video voiceover

“You made the connection. Now keep the conversation going!

“Meet TapSynk. One tap shares your business profile. No app needed!

“With the AI Card, customers can ask about your services—even while you’re busy.

“Help them take the next step, and book an available appointment.

“Capture contacts they choose to share. Track activity in your dashboard.

“Your premium smart card is included. Update your details without a reprint.

“Ready to see it work for your business? Book your free fifteen-minute TapSynk demo today!”

Delivery: upbeat, clear and friendly. Emphasize “one tap,” “AI Card,” and “next step.” Pause before the closing invitation. The supplied video uses a local synthetic English voice and illustrative motion graphics.

## Pricing reference

| Plan | Monthly | Every 3 months | Yearly |
|---|---:|---:|---:|
| Virtual Card | $20 | $49 | $149 |
| AI Card | $49 | $119 | $399 |

Amounts are USD and are billing-period totals, not monthly equivalents. Virtual has a 30-day first trial for eligible accounts. AI and company plans are paid from day one. Subscriptions renew automatically. Shipping is limited to the countries supported by checkout.

## Messaging issues found in the website

- “Any phone,” “answers every question,” and “any language” are broader than should be promised without compatibility and performance evidence. Use “compatible phone” with QR backup and “questions about your supplied business information.”
- The comparison table implies knowing who viewed or saved the card. The reviewed analytics show activity counts; named leads come from people who submit contact details. Say “track views and saves,” not “identify every visitor.”
- The AI Card has no free trial. Keep its paid features separate from the Virtual Card trial in every pitch.
- Appointment examples mention calendars, but the reviewed workflow stores bookings in TapSynk. Do not advertise external calendar synchronization without verifying an integration.
- The headline about the AI selling is positioning, not evidence of sales results. Use a real demonstration instead of promised conversion improvements.
- No production domain was confirmed. The video deliberately uses a demo invitation without printing an unverified URL. Add your confirmed demo URL to the post or ad destination.

## Source references

- `src/app/(marketing)/page.tsx`, `pricing/page.tsx`, `demo/page.tsx`
- `src/lib/plans.ts`, `src/app/api/stripe/checkout/route.ts`
- `src/components/PricingTable.tsx`, `UseCases.tsx`, `ProfileCard.tsx`, `CompanyPricing.tsx`
- `src/app/c/[slug]/page.tsx` and individual/company dashboard pages
- `src/app/dashboard/ai/AgentEditor.tsx`, leads and appointments interfaces
- Signup, terms and privacy pages
