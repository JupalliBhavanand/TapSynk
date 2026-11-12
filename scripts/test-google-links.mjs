import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks = {}, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(output, { module: loaded, exports: loaded.exports, require: name => name in mocks ? mocks[name] : require(name), URL, console, ...globals });
  return loaded.exports;
}
const links = load('src/lib/google-links.ts');
const email = 'owner+work@example.com';
const calendar = new URL(links.googleCalendarUrl(email));
assert.equal(calendar.hostname, 'calendar.google.com');
assert.equal(calendar.searchParams.get('authuser'), email);
assert.equal(new URL(links.googleMeetHomeUrl(email)).hostname, 'meet.google.com');
const meet = 'https://meet.google.com/abc-defg-hij?authuser=wrong@example.com&hs=122';
const joined = new URL(links.googleMeetJoinUrl(meet, email));
assert.equal(joined.pathname, '/abc-defg-hij');
assert.equal(joined.searchParams.get('authuser'), email);
assert.equal(joined.searchParams.get('hs'), '122');
for (const invalid of ['javascript:alert(1)', 'http://meet.google.com/abc-defg-hij', 'https://meet.google.com.evil.example/abc-defg-hij', 'https://user@meet.google.com/abc-defg-hij', 'https://meet.google.com:8443/abc-defg-hij', 'https://meet.google.com/', 'https://evil.example/abc-defg-hij']) assert.equal(links.googleMeetJoinUrl(invalid, email), null);
const now = Date.parse('2030-01-01T09:00:00Z');
const base = { id: 'appointment', card_id: 'card', email: 'guest@example.com', starts_at: '2030-01-01T10:00:00Z', ends_at: '2030-01-01T10:30:00Z', status: 'confirmed', google_meet_url: meet };
const bookings = [base, { ...base, id: 'later', starts_at: '2030-01-02T10:00:00Z', ends_at: '2030-01-02T10:30:00Z' }, { ...base, id: 'cancelled', status: 'cancelled', starts_at: '2030-01-01T09:30:00Z' }];
const leads = [{ id: 'lead', card_id: 'card', email: ' GUEST@EXAMPLE.COM ' }, { id: 'different-card', card_id: 'other', email: 'guest@example.com' }, { id: 'different-email', card_id: 'card', email: 'someone@example.com' }, { id: 'no-email', card_id: 'card', email: '' }];
const matched = links.matchLeadMeetings(leads, bookings, now);
assert.equal(matched.lead.id, 'appointment');
assert.equal(Object.keys(matched).length, 1, 'Never match unrelated people/cards or cancelled bookings');
assert.equal(Object.keys(links.matchLeadMeetings(leads, [base], Date.parse('2030-01-01T11:00:00Z'))).length, 0);

const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const { GoogleWorkspaceButtons } = load('src/components/GoogleWorkspaceButtons.tsx', { '@/lib/google-links': links });
const html = renderToStaticMarkup(React.createElement(GoogleWorkspaceButtons, { email }));
assert.ok(html.includes('Google Calendar')); assert.ok(html.includes('Google Meet'));
assert.ok(html.includes('authuser=owner%2Bwork%40example.com'));
assert.equal((html.match(/target="_blank"/g) || []).length, 2);
const { GoogleMeetButton } = load('src/components/GoogleMeetButton.tsx', { '@/lib/google-links': links, '@/app/dashboard/appointments/calendar-actions': {} });
const ready = renderToStaticMarkup(React.createElement(GoogleMeetButton, { id: 'appointment', status: 'confirmed', meetUrl: meet, accountEmail: email }));
assert.ok(ready.includes('Join Google Meet')); assert.ok(ready.includes('abc-defg-hij')); assert.ok(ready.includes('authuser=owner%2Bwork%40example.com'));
const missing = renderToStaticMarkup(React.createElement(GoogleMeetButton, { id: 'appointment', status: 'confirmed', accountEmail: email }));
assert.ok(missing.includes('Set up Google Meet'));
const cancelled = renderToStaticMarkup(React.createElement(GoogleMeetButton, { id: 'appointment', status: 'cancelled', meetUrl: meet, accountEmail: email }));
assert.ok(cancelled.includes('disabled')); assert.ok(!cancelled.includes('<a '));

let transition, destination, serverCalls = 0;
let result = { ok: true, meetUrl: 'https://meet.google.com/xyz-abcd-efg' };
const interactive = load('src/components/GoogleMeetButton.tsx', {
  react: { useState: initial => [initial, () => {}], useTransition: () => [false, fn => { transition = fn(); }] },
  '@/lib/google-links': links,
  '@/app/dashboard/appointments/calendar-actions': { syncCalendar: async id => { assert.equal(id, 'appointment'); serverCalls++; return result; } },
}, { window: { location: { assign: url => { destination = url; } } } });
let tree = interactive.GoogleMeetButton({ id: 'appointment', status: 'confirmed', accountEmail: email });
tree.props.children[0].props.onClick(); await transition;
assert.equal(serverCalls, 1); assert.equal(new URL(destination).pathname, '/xyz-abcd-efg'); assert.equal(new URL(destination).searchParams.get('authuser'), email);
destination = undefined; result = { ok: false, message: 'Connect Google Calendar first.' };
tree = interactive.GoogleMeetButton({ id: 'appointment', status: 'confirmed', accountEmail: email });
tree.props.children[0].props.onClick(); await transition;
assert.equal(destination, undefined, 'Never open a random meeting when sync fails');
console.log('PASS: Google account shortcuts, real meeting links, secure destinations, lead booking matching, and one-click prepared-meeting navigation.');
