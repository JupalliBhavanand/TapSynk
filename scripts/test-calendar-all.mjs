import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks = {}, globals = {}) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { module: loaded, exports: loaded.exports, require: name => name in mocks ? mocks[name] : name === 'server-only' ? {} : require(name), URL, URLSearchParams, Buffer, AbortSignal, setTimeout, console, process, ...globals });
  return loaded.exports;
}
const owner = 'owner';
const id = i => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const eventId = id => `ts${id.replaceAll('-', '')}1`;
const bookings = Array.from({ length: 12 }, (_, i) => ({ id: id(i + 1), owner_id: owner, card_id: 'card', name: `Guest ${i}`, email: `guest${i}@example.com`, starts_at: `${i < 7 ? '2020' : '2035'}-01-01T10:00:00Z`, ends_at: `${i < 7 ? '2020' : '2035'}-01-01T10:30:00Z`, status: i === 2 ? 'completed' : [3, 4].includes(i) ? 'cancelled' : 'confirmed', google_event_version: 1, google_event_id: i === 3 ? eventId(id(i + 1)) : null, calendar_sync_status: 'pending' }));
const foreign = { ...bookings[0], id: id(99), owner_id: 'other' };
const store = { appointments: [...bookings, foreign], google_calendar_connections: [{ user_id: owner, refresh_token_encrypted: 'encrypted', last_error: null, meet_enabled: true }], cards: [{ id: 'card', user_id: owner, full_name: 'Host', company: 'Studio', slug: 'host' }] };
class Query {
  constructor(table) { this.table = table; this.filters = []; this.max = Infinity; }
  select() { return this; } eq(key, value) { this.filters.push(row => row[key] === value); return this; }
  gt(key, value) { this.filters.push(row => row[key] > value); return this; }
  or(value) { assert.equal(value, 'status.neq.cancelled,google_event_id.not.is.null'); this.filters.push(row => row.status !== 'cancelled' || row.google_event_id != null); return this; }
  order(key) { this.sort = key; return this; } limit(max) { this.max = max; return this; }
  update(value) { this.value = value; return this; }
  async execute(single = false) {
    let rows = store[this.table].filter(row => this.filters.every(test => test(row)));
    const count = rows.length;
    if (this.sort) rows.sort((a, b) => String(a[this.sort]).localeCompare(String(b[this.sort])));
    rows = rows.slice(0, this.max);
    if (this.value) rows.forEach(row => Object.assign(row, this.value));
    rows = rows.map(row => ({ ...row }));
    return { data: single ? rows[0] || null : rows, count, error: null };
  }
  single() { return this.execute(true); } maybeSingle() { return this.execute(true); }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
}
const events = new Map([[bookings[3].google_event_id, { id: bookings[3].google_event_id }]]);
let creates = 0, historicalImports = 0;
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
const fetch = async (input, init = {}) => {
  if (String(input).includes('oauth2.googleapis.com/token')) return response({ access_token: 'token' });
  const url = new URL(input), key = url.pathname.split('/').at(-1);
  if (init.method === 'POST') {
    const body = JSON.parse(init.body), booking = bookings.find(item => eventId(item.id) === body.id);
    assert.ok(booking, 'No other owner is synced');
    if (booking.status === 'completed' || Date.parse(booking.ends_at) < Date.now()) {
      historicalImports++; assert.equal(body.attendees.length, 0, 'Do not send historical invitations'); assert.equal(url.searchParams.get('sendUpdates'), 'none');
    } else { assert.equal(body.attendees[0].email, booking.email); assert.equal(url.searchParams.get('sendUpdates'), 'all'); }
    const event = { ...body, hangoutLink: 'https://meet.google.com/abc-defg-hij' };
    creates++; events.set(body.id, event); return response(event);
  }
  if (init.method === 'DELETE') { const removed = events.delete(key); return response({}, removed ? 200 : 404); }
  if (init.method === 'PATCH') { const event = events.get(key); if (!event) return response({}, 404); Object.assign(event, JSON.parse(init.body)); return response(event); }
  return events.has(key) ? response(events.get(key)) : response({}, 404);
};
const calendar = load('src/lib/google-calendar.ts', {
  '@/lib/supabase/admin': { createAdminClient: () => ({ from: table => new Query(table) }) },
  '@/lib/calendar-tokens': { decryptCalendarToken: () => 'refresh' }, '@/lib/env': { SITE_URL: 'https://tapsynk.example' },
}, { fetch, process: { env: { GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', GOOGLE_CALENDAR_TOKEN_KEY: Buffer.alloc(32).toString('base64') } } });
async function all() {
  let cursor, processed = 0, failed = 0, pages = 0;
  do { const batch = await calendar.syncAllCalendarBatch(owner, cursor); assert.ok(!batch.fatal, batch.message); processed += batch.processed; failed += batch.failed; cursor = batch.nextCursor || undefined; pages++; } while (cursor);
  return { processed, failed, pages };
}
const first = await all();
assert.equal(first.processed, 11); assert.equal(first.failed, 0); assert.equal(first.pages, 3, 'Process beyond the first two pages');
assert.equal(creates, 10); assert.ok(historicalImports >= 5);
assert.ok(events.has(eventId(bookings[2].id)), 'Completed historical meetings are included');
assert.ok(!events.has(eventId(foreign.id))); assert.ok(!events.has(eventId(bookings[3].id)), 'Cancelled meetings are removed');
await all(); assert.equal(creates, 10, 'Repeated complete sync does not duplicate events');

const links = load('src/lib/google-links.ts');
const button = load('src/components/GoogleMeetButton.tsx', { '@/lib/google-links': links, '@/app/dashboard/appointments/calendar-actions': {} });
const { AppointmentActions } = load('src/app/dashboard/appointments/AppointmentActions.tsx', { '@/components/GoogleMeetButton': button, '../actions': {}, './actions': {} });
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const markup = renderToStaticMarkup(React.createElement(AppointmentActions, { id: id(1), status: 'confirmed', meetUrl: 'https://meet.google.com/abc-defg-hij', accountEmail: 'host@example.com' }));
assert.ok(markup.indexOf('>Cancel</button>') < markup.indexOf('aria-label="Join Google Meet"'));
assert.ok(markup.includes('authuser=host%40example.com'));
assert.ok(!markup.includes('Join Google Meet<'), 'The row action is icon-only');
console.log('PASS: all batches, past/completed imports without invitations, owner isolation, repeat-sync deduplication, and Meet icon beside Cancel.');
