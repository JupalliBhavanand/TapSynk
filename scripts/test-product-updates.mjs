import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(source, { module: loadedModule, exports: loadedModule.exports, require: name => name in mocks ? mocks[name] : name === 'server-only' ? {} : require(name), URL, URLSearchParams, Buffer, AbortSignal, setTimeout, console, process, ...globals }, { filename: file });
  return loadedModule.exports;
}

const plans = load('src/lib/plans.ts');
assert.equal(plans.PLANS.virtual.prices.month, 10);
assert.equal(plans.PLANS.ai.prices.month, 25);
for (const tier of ['virtual', 'ai']) for (const interval of ['quarter', 'year']) assert.ok(plans.savingsPercent(tier, interval) > 0);
assert.equal(plans.companyQuote('virtual', 2).unit, 900);
assert.equal(plans.companyQuote('ai', 25).unit, 2000);

// Duplicate emails, including unconfirmed accounts, never reach signUp.
let exists = true, lookupError = null, signups = 0;
let signupResponse = { data: { user: { identities: [{ provider: 'email' }] }, session: null }, error: null };
const auth = load('src/app/(auth)/actions.ts', {
  'next/navigation': { redirect: value => { throw new Error(`redirect:${value}`); } },
  'next/headers': { headers: async () => new Headers() },
  '@/lib/rate-limit': { rateLimit: async () => true },
  '@/lib/utils': { clientIp: () => 'test-ip' },
  '@/lib/env': { SITE_URL: 'https://tapsynk.example' },
  '@/lib/redirect': { safeRedirectPath: () => '/dashboard' },
  '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async (name, args) => { assert.equal(name, 'account_email_exists'); assert.equal(args.candidate, 'alex@example.com'); return { data: exists, error: lookupError }; } }) },
  '@/lib/supabase/server': { createClient: async () => ({ auth: { signUp: async () => { signups++; return signupResponse; } } }) },
}, { Headers });
const form = new FormData();
for (const [key, value] of Object.entries({ fullName: 'Alex Morgan', email: ' Alex@Example.com ', password: 'Password123' })) form.set(key, value);
assert.match((await auth.signup(undefined, form)).error, /Account already exists/);
assert.equal(signups, 0);
exists = false;
assert.match((await auth.signup(undefined, form)).message, /confirmation link/);
assert.equal(signups, 1);
signupResponse = { data: { user: { identities: [] }, session: null }, error: null };
assert.match((await auth.signup(undefined, form)).error, /Account already exists/);
lookupError = { code: 'missing-migration' };
assert.match((await auth.signup(undefined, form)).error, /temporarily unavailable/);
assert.equal(signups, 2);

// Encryption is authenticated, and a wrong key/tampered token cannot be decrypted.
const env = { GOOGLE_CALENDAR_TOKEN_KEY: Buffer.alloc(32, 7).toString('base64') };
const tokens = load('src/lib/calendar-tokens.ts', {}, { process: { env } });
const encrypted = tokens.encryptCalendarToken('secret-refresh-token');
assert.ok(!encrypted.includes('secret-refresh-token'));
assert.equal(tokens.decryptCalendarToken(encrypted), 'secret-refresh-token');
const altered = encrypted.split('.'); altered[2] = Buffer.from('tampered').toString('base64url');
assert.throws(() => tokens.decryptCalendarToken(altered.join('.')));
env.GOOGLE_CALENDAR_TOKEN_KEY = Buffer.alloc(32, 8).toString('base64');
assert.throws(() => tokens.decryptCalendarToken(encrypted));

// Actual animated GIFs decode as twelve frames, with a useful first frame.
const { signatureMotionGif } = load('src/lib/signature-motion.ts');
const sharp = require('sharp');
const gif = signatureMotionGif('5654d9', true);
assert.equal(gif.subarray(0, 6).toString(), 'GIF89a');
assert.ok(gif.length < 6000);
const metadata = await sharp(gif, { animated: true }).metadata();
assert.equal(metadata.pages, 12);
assert.equal(metadata.pageHeight, 6);
assert.equal(metadata.loop, 0);
await sharp(gif, { animated: true }).raw().toBuffer();
const { buildEmailSignature, defaultSignatureSettings } = load('src/lib/email-signature.ts');
const card = { full_name: 'Alex', job_title: 'Founder', company: 'Forma', email: 'a@example.com', phone: '', accent: '#5654d9' };
const animated = buildEmailSignature(card, 'https://tapsynk.example/c/alex', { ...defaultSignatureSettings, motion: 'float' });
assert.ok(animated.html.includes('/api/signature-portrait?'), 'Export retains the email-compatible portrait asset');
assert.ok(animated.html.includes('href="mailto:a@example.com"'), 'Email link remains independently clickable');
assert.ok(animated.html.includes('href="https://tapsynk.example/c/alex"'), 'Profile link is preserved');
assert.ok(!buildEmailSignature(card, 'https://tapsynk.example/c/alex', { ...defaultSignatureSettings, motion: 'none' }).html.includes('/api/signature-motion'));

// Pagination's data source fetches past the default Supabase row cap and fails visibly.
const { loadListRows } = load('src/lib/list-data.ts');
const dataset = Array.from({ length: 1101 }, (_, id) => ({ id }));
const ranges = [];
const rows = await loadListRows(async (from, to) => { ranges.push([from, to]); return { data: dataset.slice(from, to + 1), error: null }; });
assert.equal(rows.length, 1101);
assert.equal(ranges.length, 3);
assert.equal(rows[1100].id, 1100);
await assert.rejects(loadListRows(async () => ({ data: null, error: { code: 'failed' } })), /Could not load/);

// Calendar integration: isolated in-memory database and Google API, no network/account required.
const ownerId = 'owner';
const appointment = { id: '10ea95cb-0ef1-4d52-a53a-1a83bf312100', owner_id: ownerId, card_id: 'card', name: 'Alex', email: 'alex@example.com', notes: 'A discovery call', starts_at: '2031-01-01T10:00:00Z', ends_at: '2031-01-01T10:30:00Z', status: 'confirmed', google_event_version: 1, calendar_sync_status: 'pending' };
const store = { appointments: [appointment], google_calendar_connections: [{ user_id: ownerId, refresh_token_encrypted: 'encrypted' }], cards: [{ id: 'card', user_id: ownerId, full_name: 'Host', company: 'Forma', slug: 'host' }] };
class Query {
  constructor(table) { this.table = table; this.filters = []; }
  select() { return this; } eq(key, value) { this.filters.push(row => row[key] === value); return this; }
  update(values) { this.values = values; return this; }
  async execute(single = false) { const rows = store[this.table].filter(row => this.filters.every(fn => fn(row))); if (this.values) rows.forEach(row => Object.assign(row, this.values)); return { data: single ? rows[0] || null : rows, error: null }; }
  single() { return this.execute(true); } maybeSingle() { return this.execute(true); }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
}
const events = new Map();
let inserted = 0, deleted = 0, patched = 0, failGoogle = false, conferencePending = false;
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const fetchGoogle = async (input, init = {}) => {
  if (String(input).includes('oauth2.googleapis.com/token')) return response({ access_token: 'test-access' });
  if (failGoogle) return response({}, 403);
  const url = new URL(input), id = url.pathname.split('/').at(-1);
  if (init.method === 'POST') {
    const body = JSON.parse(init.body);
    if (events.has(body.id)) return response({}, 409);
    inserted++;
    assert.equal(url.searchParams.get('conferenceDataVersion'), '1');
    assert.equal(url.searchParams.get('sendUpdates'), 'all');
    assert.equal(body.attendees[0].email, appointment.email);
    assert.equal(body.start.dateTime, appointment.starts_at);
    const event = { ...body, ...(conferencePending ? { conferenceData: { createRequest: { status: { statusCode: 'pending' } } } } : { hangoutLink: 'https://meet.google.com/abc-defg-hij' }) };
    events.set(body.id, event); return response(event);
  }
  if (init.method === 'DELETE') { const had = events.delete(id); if (had) deleted++; return response({}, had ? 200 : 404); }
  if (init.method === 'PATCH') { const event = events.get(id); if (!event) return response({}, 404); patched++; Object.assign(event, JSON.parse(init.body)); return response(event); }
  return events.has(id) ? response(events.get(id)) : response({}, 404);
};
const calendar = load('src/lib/google-calendar.ts', {
  '@/lib/supabase/admin': { createAdminClient: () => ({ from: table => new Query(table) }) },
  '@/lib/calendar-tokens': { decryptCalendarToken: () => 'refresh-token' },
  '@/lib/env': { SITE_URL: 'https://tapsynk.example' },
}, { fetch: fetchGoogle });
assert.equal(calendar.validMeetUrl('https://meet.google.com/abc-defg-hij'), true);
assert.equal(calendar.validMeetUrl('https://meet.google.com.evil.com/abc'), false);
assert.equal(calendar.validMeetUrl('javascript:alert(1)'), false);
assert.match(calendar.calendarEventId(appointment.id, 1), /^[0-9a-v]+$/);
assert.equal((await calendar.syncAppointmentToGoogle(appointment.id, 'other-owner')).ok, false);
assert.equal(inserted, 0);
const synced = await calendar.syncAppointmentToGoogle(appointment.id, ownerId);
assert.equal(synced.ok, true, synced.message); assert.equal(synced.meetUrl, 'https://meet.google.com/abc-defg-hij');
assert.equal(appointment.calendar_sync_status, 'synced'); assert.equal(inserted, 1);
await calendar.syncAppointmentToGoogle(appointment.id, ownerId);
assert.equal(inserted, 1, 'Retry never creates duplicate events/invitations');
appointment.starts_at = '2031-01-01T11:00:00Z'; appointment.calendar_sync_status = 'pending';
failGoogle = true;
assert.equal((await calendar.syncAppointmentToGoogle(appointment.id, ownerId)).ok, false);
assert.equal(appointment.calendar_sync_status, 'failed');
failGoogle = false;
await calendar.syncAppointmentToGoogle(appointment.id, ownerId);
assert.equal(patched, 1, 'Retrying a failed update patches the existing event');
assert.equal(events.get(appointment.google_event_id).start.dateTime, appointment.starts_at);
appointment.status = 'cancelled'; appointment.calendar_sync_status = 'pending';
await calendar.syncAppointmentToGoogle(appointment.id, ownerId);
assert.equal(deleted, 1); assert.equal(appointment.google_meet_url, null);
await calendar.syncAppointmentToGoogle(appointment.id, ownerId);
assert.equal(deleted, 1, 'Cancellation is idempotent');
appointment.status = 'confirmed'; appointment.google_event_version = 2; appointment.google_event_id = null; appointment.calendar_sync_status = 'pending'; conferencePending = true;
await calendar.syncAppointmentToGoogle(appointment.id, ownerId);
assert.equal(inserted, 2); assert.equal(appointment.calendar_sync_status, 'pending');
events.get(appointment.google_event_id).hangoutLink = 'https://meet.google.com/xyz-abcd-efg';
events.get(appointment.google_event_id).conferenceData = { createRequest: { status: { statusCode: 'success' } } };
await calendar.syncAppointmentToGoogle(appointment.id, ownerId);
assert.equal(appointment.google_meet_url, 'https://meet.google.com/xyz-abcd-efg');
assert.equal(appointment.calendar_sync_status, 'synced');
console.log('Product updates: pricing, duplicate signup, encrypted tokens, animated GIFs, pagination, Calendar/Meet retries and ownership passed.');

// Exercise pagination state and narrated highlights with deterministic browser hooks.
function fakeHooks() {
  const state = [], refs = [], cleanup = [];
  let index = 0, refIndex = 0, mounted = false;
  const react = {
    useState(initial) { const i = index++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(initial) { const i = refIndex++; return refs[i] ||= { current: initial }; },
    useEffect(effect) { if (!mounted) cleanup.push(effect()); },
  };
  return { react, state, cleanup, render(fn) { index = 0; refIndex = 0; const result = fn(); mounted = true; return result; } };
}
const pagerHooks = fakeHooks();
const { usePagination } = load('src/components/Pagination.tsx', { react: pagerHooks.react });
const dataRows = Array.from({ length: 55 }, (_, id) => id);
let pager = pagerHooks.render(() => usePagination(dataRows, 'all'));
assert.equal(pager.items.length, 20); assert.equal(pager.props.pages, 3);
pager.props.onPage(3); pager = pagerHooks.render(() => usePagination(dataRows, 'all'));
assert.equal(pager.items.length, 15); assert.equal(pager.items[0], 40);
pager = pagerHooks.render(() => usePagination([1, 2, 3], 'filtered'));
assert.equal(pager.props.page, 1); assert.equal(pager.items.length, 3);
pager.props.onSize(10); pager = pagerHooks.render(() => usePagination(dataRows, 'all'));
assert.equal(pager.props.pages, 6); assert.equal(pager.props.page, 1);
pager.props.onPage(999); pager = pagerHooks.render(() => usePagination(dataRows, 'all'));
assert.equal(pager.props.page, 6);
const tourHooks = fakeHooks();
const sections = new Map(['product-intro', 'how', 'email-signatures', 'ai', 'pricing'].map(id => [id, { active: false, setAttribute() { this.active = true; }, removeAttribute() { this.active = false; }, scrollIntoView(options) { assert.equal(options.behavior, 'instant'); } }]));
const speeches = []; let cancellations = 0;
const browser = { speechSynthesis: { speak: speech => speeches.push(speech), cancel: () => cancellations++, getVoices: () => [] }, matchMedia: () => ({ matches: true }) };
const tour = load('src/components/ProductVoiceTour.tsx', { react: tourHooks.react, '@/lib/product-tour': load('src/lib/product-tour.ts', { '@/lib/plans': plans }) }, {
  window: browser,
  Audio: class { pause() {} removeAttribute() {} load() {} play() { this.onerror?.(); return Promise.resolve(); } },
  document: { getElementById: id => sections.get(id), querySelectorAll: () => [...sections.values()].filter(section => section.active) },
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
});
function elements(node, predicate) { if (!node || typeof node !== 'object') return []; const children = node.props?.children; return [...(predicate(node) ? [node] : []), ...(Array.isArray(children) ? children.flatMap(child => elements(child, predicate)) : elements(children, predicate))]; }
let tree = tourHooks.render(() => tour.ProductVoiceTour());
assert.equal(speeches.length, 0, 'Homepage never autoplays speech');
elements(tree, node => node.type === 'button')[0].props.onClick();
assert.equal(speeches.length, 1); assert.ok([...sections.values()].every(section => !section.active), 'Narration never adds blue section markers');
assert.ok(speeches[0].rate > 1, 'Fallback narration has a livelier delivery');
speeches[0].onend();
assert.equal(speeches.length, 2); assert.ok([...sections.values()].every(section => !section.active));
tree = tourHooks.render(() => tour.ProductVoiceTour());
elements(tree, node => node.props?.['aria-label'] === 'Stop voice tour')[0].props.onClick();
assert.ok(cancellations >= 1); assert.ok([...sections.values()].every(section => !section.active));
assert.equal(tourHooks.state[0], null);
tree = tourHooks.render(() => tour.ProductVoiceTour());
elements(tree, node => node.type === 'button')[0].props.onClick();
tourHooks.cleanup.filter(Boolean).forEach(fn => fn());
assert.ok(cancellations >= 2, 'Navigation stops narration');
console.log('UI behavior: pagination/filter reset, narration opt-in, no section outlines, stop and cleanup passed.');
