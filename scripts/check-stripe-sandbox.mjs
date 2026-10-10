import Stripe from 'stripe';
if (!process.argv.includes('--run')) throw new Error('Add --run to create and expire a sandbox checkout session.');
const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key?.startsWith('sk_test_')) throw new Error('This check requires a test key; live keys are refused.');
const stripe = new Stripe(key);
let session;
try {
 session = await stripe.checkout.sessions.create({
  managed_payments: { enabled: false }, mode: 'subscription',
  line_items: [{ price_data: { currency: 'usd', product_data: { name: 'TapSynk checkout verification' }, unit_amount: 4900, recurring: { interval: 'month' } }, quantity: 1 }],
  shipping_address_collection: { allowed_countries: ['US', 'IN'] },
  custom_text: { submit: { message: 'Checkout verification only.' }, shipping_address: { message: 'Verification shipping details.' } },
  allow_promotion_codes: true, phone_number_collection: { enabled: true },
  success_url: 'https://tapsynk.com/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://tapsynk.com/dashboard/billing',
 });
 if (session.livemode || !session.url) throw new Error('Unexpected checkout response.');
 console.log('PASS: Stripe accepted sandbox Checkout with custom text, shipping and Managed Payments disabled. No payment made.');
} catch (error) {
 console.error(JSON.stringify({ type: error.type, code: error.code, param: error.param, requestId: error.requestId }));
 process.exitCode = 1;
} finally { if (session) await stripe.checkout.sessions.expire(session.id); }
