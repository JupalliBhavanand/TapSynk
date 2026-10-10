import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const mod = { exports: {} };
const invoice = { id: 'in_test', status: 'paid', amount_paid: 2900, currency: 'usd', number: 'BILL-001', created: 1791504000, status_transitions: { paid_at: 1791504000 }, customer_name: '<Shiva>', customer_email: 'customer@example.test', lines: { data: [{ description: 'AI Card', amount: 2900 }] }, hosted_invoice_url: 'https://invoice.stripe.com/bill', invoice_pdf: 'https://invoice.stripe.com/pdf' };
let row; let sends = 0; let fail = false; let noAcceptance = false; const delivered = [];
invoice.parent = { subscription_details: { metadata: { user_id: 'test-user' } } };
const db = { from: () => {
 let action; let values; const filters = [];
 const query = {
  upsert: async () => { row ??= { status: 'pending' }; return { error: null }; },
  update: value => { action = 'update'; values = value; return query; },
  select: () => query,
  eq: (key, value) => { filters.push([key, value]); return query; },
  maybeSingle: async () => {
   if (action === 'update') {
    if (!filters.every(([key, value]) => key === 'stripe_invoice_id' || row?.[key] === value)) return { data: null };
    Object.assign(row, values); return { data: { stripe_invoice_id: invoice.id } };
   }
   return { data: row };
  },
  then(resolve) { if (action === 'update') Object.assign(row, values); return Promise.resolve({ error: null }).then(resolve); },
 }; return query;
} };
const mocks = {
 'server-only': {}, '@/lib/stripe': { stripe: () => ({ invoices: { retrieve: async () => invoice } }) },
 '@/lib/supabase/admin': { createAdminClient: () => db },
 '@/lib/appointment-mail': { companyMailSettings: () => ({ from: { address: 'company@example.test', name: 'TapSynk' }, transport: {} }), mailConfigurationError: () => undefined, mailFailure: () => ({ code: 'TEST' }) },
 nodemailer: { createTransport: () => ({ sendMail: async message => { sends++; if (fail) throw new Error('SMTP failure'); delivered.push(message); return { accepted: noAcceptance ? [] : [invoice.customer_email] }; }, close() {} }) },
};
const code = ts.transpileModule(fs.readFileSync('src/lib/payment-mail.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; }, Buffer, URL, Intl, Date, AbortSignal, console: { error() {} }, fetch: async () => new Response(Buffer.from('%PDF-1.7 test')) });
const { paymentMessage, sendPaymentConfirmation } = mod.exports;
assert.match(paymentMessage(invoice).text, /\$29\.00/);
assert.ok(!paymentMessage(invoice).html.includes('<Shiva>'));
assert.throws(() => paymentMessage({ ...invoice, invoice_pdf: 'http://127.0.0.1/private' }));
assert.match(paymentMessage({ ...invoice, currency: 'jpy', amount_paid: 2900 }).text, /2,900/);
await Promise.all([sendPaymentConfirmation(invoice.id), sendPaymentConfirmation(invoice.id)].map(promise => promise.catch(error => assert.match(error.message, /already being processed/))));
assert.equal(sends, 1); assert.equal(row.status, 'sent');
assert.equal(delivered[0].to, invoice.customer_email);
assert.equal(delivered[0].from.address, 'company@example.test');
assert.equal(delivered[0].attachments[0].content.subarray(0, 5).toString(), '%PDF-');
await sendPaymentConfirmation(invoice.id); assert.equal(sends, 1);
row = undefined; invoice.status = 'open'; await sendPaymentConfirmation(invoice.id); assert.equal(row, undefined);
invoice.status = 'paid'; invoice.amount_paid = 0; await sendPaymentConfirmation(invoice.id); assert.equal(row, undefined);
invoice.amount_paid = 2900; const parent = invoice.parent; invoice.parent = null;
await sendPaymentConfirmation(invoice.id); assert.equal(row, undefined); invoice.parent = parent;
invoice.amount_paid = 2900; fail = true;
await assert.rejects(sendPaymentConfirmation(invoice.id), /webhook will retry/); assert.equal(row.status, 'pending');
fail = false; noAcceptance = true;
await assert.rejects(sendPaymentConfirmation(invoice.id), /webhook will retry/); assert.equal(row.status, 'pending');
noAcceptance = false; invoice.invoice_pdf = null;
await sendPaymentConfirmation(invoice.id); assert.equal(row.status, 'sent');
assert.match(delivered.at(-1).attachments[0].filename, /\.html$/);
console.log('PASS: paid invoices only; company sender; PDF bill attachment; escaped customer details; zero-decimal currency; concurrent/replayed webhook deduplication; failed email retry; printable fallback bill.');
