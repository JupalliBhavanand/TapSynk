import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(source, { module: loaded, exports: loaded.exports, require: name => name in mocks ? mocks[name] : name === 'server-only' ? {} : require(name), Buffer, URL, URLSearchParams, AbortSignal, setTimeout, console, process, ...globals }, { filename: file });
  return loaded.exports;
}
const types = load('src/lib/notification-types.ts');
assert.equal(types.notificationHref('javascript:alert(1)'), '/dashboard');
assert.equal(types.notificationHref('//evil.example'), '/dashboard');
assert.equal(types.notificationHref('/dashboard/company/leads'), '/dashboard/company/leads');
const seen = new Set(['old']);
const notices = [{ id: 'new', read_at: null }, { id: 'old', read_at: null }, { id: 'read', read_at: 'today' }];
assert.equal(types.newNotificationItems(seen, notices).map(n => n.id).join(), 'new');
assert.equal(types.newNotificationItems(seen, notices).length, 0, 'Realtime and polling never duplicate a popup');

const id = '01472c16-5c72-40d2-a788-15b8dbb37eb5';
const ownerId = 'actual-owner';
const notice = { id, owner_id: ownerId, kind: 'lead', entity_id: 'lead-id', title: 'New lead', body: '<Alex> shared a contact.', href: '/dashboard/leads', email_status: 'pending' };
const other = { id: '1139de58-1171-4dd4-9d4a-89aa3d132e92', owner_id: 'someone-else', kind: 'lead', entity_id: 'other-lead', email_status: 'pending' };
const store = { notifications: [notice, other], leads: [{ id: 'lead-id', owner_id: ownerId, name: '<Alex>', email: 'visitor@example.com', phone: '', company: 'A & B', message: '<script>bad()</script>' }], appointments: [] };
const updates = [];
let statusWriteError = false;
class Query {
  constructor(table) { this.table = table; this.filters = []; }
  select() { return this; } eq(key, value) { this.filters.push(row => row[key] === value); return this; }
  is(key, value) { this.filters.push(row => (row[key] ?? null) === value); return this; }
  lt(key, value) { this.filters.push(row => row[key] < value); return this; }
  update(value) { this.value = value; return this; } order() { return this; } limit() { return this; }
  async execute(single = false) {
    const rows = store[this.table].filter(row => this.filters.every(fn => fn(row)));
    if (this.value) {
      updates.push(this.value);
      if (statusWriteError && this.value.email_status === 'sent') return { data: null, error: { code: 'database' } };
      rows.forEach(row => Object.assign(row, this.value));
    }
    const result = rows.map(row => ({ ...row }));
    return { data: single ? result[0] || null : result, error: null };
  }
  single() { return this.execute(true); } maybeSingle() { return this.execute(true); }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
}
const messages = [];
let mailError = null, closes = 0, configured = true;
const database = { from: table => new Query(table), auth: { admin: { getUserById: async userId => { assert.equal(userId, ownerId); return { data: { user: { email: 'account-owner@example.com' } }, error: null }; } } } };
const mail = load('src/lib/notification-mail.ts', {
  '@/lib/google-calendar': { validMeetUrl: value => typeof value === 'string' && value.startsWith('https://meet.google.com/'), syncAppointmentToGoogle: async () => ({ ok: false }) },
  '@/lib/supabase/admin': { createAdminClient: () => database },
  '@/lib/notification-types': types,
  '@/lib/env': { SITE_URL: 'https://tapsynk.example' },
  '@/lib/appointment-mail': { mailConfigurationError: () => configured ? undefined : 'not configured', companyMailSettings: () => ({ from: { name: 'TapSynk', address: 'sender@example.com' }, transport: {} }), mailFailure: error => ({ code: error.code || 'UNKNOWN' }) },
  nodemailer: { createTransport: () => ({ sendMail: async message => { messages.push(message); if (mailError) throw mailError; return { accepted: [message.to] }; }, close: () => closes++ }) },
});
const [first, second] = await Promise.all([mail.sendOwnerNotificationEmail(id), mail.sendOwnerNotificationEmail(id)]);
assert.equal([first, second].filter(result => result.sent).length, 1);
assert.equal(messages.length, 1, 'Atomic claim prevents concurrent duplicate emails');
assert.equal(messages[0].to, 'account-owner@example.com', 'Notify the authenticated account address, never the visitor/public card email');
assert.ok(messages[0].html.includes('&lt;Alex&gt;'));
assert.ok(messages[0].html.includes('&lt;script&gt;bad()&lt;/script&gt;'));
assert.ok(!messages[0].html.includes('<script>'));
assert.ok(messages[0].text.includes('https://tapsynk.example/dashboard/leads'));
assert.equal(notice.email_status, 'sent');
assert.equal(closes, 1);
await mail.sendOwnerNotificationForEntity('lead', 'lead-id');
assert.equal(messages.length, 1);
notice.email_status = 'pending';
mailError = Object.assign(new Error('auth'), { code: 'EAUTH' });
await mail.sendOwnerNotificationEmail(id);
assert.equal(notice.email_status, 'failed', 'Definite rejection is retryable');
notice.email_status = 'pending';
mailError = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
await mail.sendOwnerNotificationEmail(id);
assert.equal(notice.email_status, 'uncertain', 'Ambiguous delivery is not automatically resent');
const attempts = messages.length;
await mail.sendOwnerNotificationEmail(id);
assert.equal(messages.length, attempts);
notice.email_status = 'pending'; mailError = null; statusWriteError = true;
assert.equal((await mail.sendOwnerNotificationEmail(id)).sent, true);
assert.equal(notice.email_status, 'sending', 'Acceptance followed by failed bookkeeping never requeues a duplicate');
statusWriteError = false;
notice.email_started_at = '2000-01-01T00:00:00Z';
other.email_started_at = '2000-01-01T00:00:00Z'; other.email_status = 'sending';
await mail.sendPendingOwnerNotifications(ownerId);
assert.equal(notice.email_status, 'uncertain', 'Abandoned jobs become reviewable');
assert.equal(other.email_status, 'sending', 'Recovery is scoped to the account owner');
notice.email_status = 'pending'; configured = false;
await mail.sendOwnerNotificationEmail(id);
assert.equal(notice.email_status, 'pending', 'Unconfigured mail remains queued');

// The studio narrator is a different upbeat voice, restricted to fixed product text.
let providerCalls = 0, request;
const plans = load('src/lib/plans.ts');
const chapters = load('src/lib/product-tour.ts', { '@/lib/plans': plans });
const audio = load('src/lib/product-tour-audio.ts', {
  '@/lib/product-tour': chapters,
  '@/lib/gemini': { GEMINI_TTS_MODEL: 'test-tts', gemini: () => ({ interactions: { create: async value => { providerCalls++; request = value; return { output_audio: { data: Buffer.from('audio').toString('base64'), mime_type: 'audio/wav' } }; } } }) },
}, { process: { env: {} } });
const renders = await Promise.all([audio.productTourAudio(0), audio.productTourAudio(0)]);
assert.equal(providerCalls, 1, 'Repeated listeners share the cached render');
assert.equal(request.generation_config.speech_config[0].voice, 'Puck');
assert.match(request.input[0].content[0].annotations[0].style, /energetic, engaging/);
assert.equal(renders[0].audio.toString(), 'audio');
assert.throws(() => audio.productTourAudio(-1), /Unknown chapter/);

// New Google conferences can be disabled independently for each linked account.
const calendar = load('src/lib/google-calendar.ts', { '@/lib/supabase/admin': {}, '@/lib/calendar-tokens': {}, '@/lib/env': { SITE_URL: 'https://tapsynk.example' } });
const booking = { id: 'booking', google_event_version: 1, name: 'Guest', email: 'guest@example.com', starts_at: '2030-01-01T10:00:00Z', ends_at: '2030-01-01T10:30:00Z' };
const host = { full_name: 'Host', company: 'Studio', slug: 'host' };
assert.ok(calendar.eventBody(booking, host).conferenceData);
assert.equal(calendar.eventBody(booking, host, false).conferenceData, undefined);
console.log('PASS: owner-only alerts, deduplicated popup/mail, SMTP uncertainty recovery, upbeat studio narration/cache, and per-account Meet preferences.');

// Notification API never acknowledges or retries another account's records.
const { NextRequest, NextResponse } = require('next/server');
const background = [];
let signedIn = true;
const api = load('src/app/api/notifications/route.ts', {
  'next/server': { NextResponse, after: fn => background.push(fn) },
  '@/lib/supabase/server': { getUser: async () => ({ user: signedIn ? { id: ownerId } : null, supabase: database }) },
  '@/lib/supabase/admin': { createAdminClient: () => database },
  '@/lib/notifications': { notificationSnapshot: async () => types.emptyNotifications },
  '@/lib/notification-mail': { sendOwnerNotificationEmail: async () => {}, sendPendingOwnerNotifications: async () => {} },
  '@/lib/rate-limit': { rateLimit: async () => true },
  '@/lib/env': { SITE_URL: 'https://tapsynk.example' },
});
const call = (body, origin = 'https://tapsynk.example') => api.POST(new NextRequest('https://tapsynk.example/api/notifications', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
notice.read_at = null; other.read_at = null;
assert.equal((await call({ action: 'read', id: other.id })).status, 200);
assert.equal(other.read_at, null);
assert.equal((await call({ action: 'read', id })).status, 200);
assert.ok(notice.read_at);
notice.read_at = null;
await call({ action: 'read_all' });
assert.ok(notice.read_at); assert.equal(other.read_at, null);
notice.email_status = 'uncertain'; other.email_status = 'failed';
assert.equal((await call({ action: 'retry_email', id })).status, 409);
assert.equal((await call({ action: 'retry_email', id: other.id })).status, 400);
assert.equal(other.email_status, 'failed');
assert.equal((await call({ action: 'retry_email', id, acknowledgeUncertain: true })).status, 200);
assert.equal(notice.email_status, 'pending');
assert.equal((await call({ action: 'read_all' }, 'https://evil.example')).status, 403);
signedIn = false;
assert.equal((await api.GET()).status, 401);
assert.equal((await call({ action: 'read_all' })).status, 401);
console.log('PASS: notification API authentication, owner-scoped read/retry, uncertainty acknowledgement, and cross-origin protection.');
