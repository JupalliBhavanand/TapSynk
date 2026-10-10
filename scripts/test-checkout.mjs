import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
 const mod = { exports: {} };
 const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
 vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => name in mocks ? mocks[name] : require(name), console, process, URL });
 return mod.exports;
}
const plans = load('src/lib/plans.ts');
const types = load('src/lib/types.ts');
const failure = load('src/lib/checkout-error.ts');
const user = { id: 'test-user', email: 'test@example.test' };
const query = table => ({ select: () => query(table), eq: () => query(table), is: () => query(table), update: () => query(table), maybeSingle: async () => ({ data: table === 'companies' ? { id: 'company-test', status: 'incomplete', name: 'Test Company' } : null }), then: resolve => Promise.resolve({ count: 0 }).then(resolve) });
const supabase = { from: query };
let session;
const mocks = {
 'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
 '@/lib/checkout-error': failure,
 '@/lib/env': { SITE_URL: 'https://tapsynk.com' },
 '@/lib/plans': plans, '@/lib/types': types,
 '@/lib/utils': { formatMoney: amount => `$${amount / 100}` },
 '@/lib/billing': { priceData: async () => ({}), companyPriceData: async () => ({}) },
 '@/lib/rate-limit': { rateLimit: async () => true },
 '@/lib/supabase/server': { getUser: async () => ({ user, supabase }) },
 '@/lib/supabase/admin': { createAdminClient: () => supabase },
 '@/lib/stripe': { stripe: () => ({ checkout: { sessions: { create: async params => { assert.equal(params.managed_payments.enabled, false); assert.ok(params.custom_text); session = params; return { url: 'https://checkout.stripe.com/test' }; } } } }) },
};
for (const [file, body] of [
 ['src/app/api/stripe/checkout/route.ts', { tier: 'ai', interval: 'month' }],
 ['src/app/api/stripe/checkout/route.ts', { tier: 'virtual', interval: 'month' }],
 ['src/app/api/stripe/company-checkout/route.ts', { tier: 'ai', seats: plans.COMPANY_MIN_SEATS }],
]) {
 const result = await load(file, mocks).POST({ json: async () => body });
 assert.equal(result.status, 200); assert.match(result.body.url, /^https:\/\/checkout.stripe.com/);
 assert.equal(session.mode, 'subscription'); assert.ok(session.shipping_address_collection);
 assert.equal(session.subscription_data.metadata.user_id, user.id);
 assert.match(session.success_url, /^https:\/\/tapsynk.com/);
}
const { stripeSecretKey } = load('src/lib/stripe.ts', { 'server-only': {}, '@/lib/env': {} });
assert.equal(stripeSecretKey(' sk_test_example123\n'), 'sk_test_example123');
assert.throws(() => stripeSecretKey('whsec_example'), /Invalid/);
assert.throws(() => stripeSecretKey('pk_live_example'), /Invalid/);
assert.ok(!JSON.stringify(failure.checkoutFailure({ message: 'secret sk_test_private', type: 'StripeAuthenticationError' })).includes('sk_test_private'));
console.log('PASS: AI, trial and company Checkout override Managed Payments; shipping, metadata and custom copy preserved; pasted-key validation; safe failure diagnostics.');
