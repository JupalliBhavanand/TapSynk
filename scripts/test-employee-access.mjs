import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(output, { module: loaded, exports: loaded.exports, require: name => name in mocks ? mocks[name] : require(name), console, Date });
  return loaded.exports;
}
const own = '1361bbf8-d9dc-42f5-9aa3-ff43a9851282';
const other = '2361bbf8-d9dc-42f5-9aa3-ff43a9851282';
let user = { id: 'employee', email: 'employee@example.com', email_confirmed_at: '2026-01-01' };
let ids = [own], rpcError = null, writes = [], cardEmail = user.email;
const reads = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { email: cardEmail } }) }) }) }), rpc: async () => ({ data: ids, error: rpcError }) };
const admin = { from: () => ({ update: value => {
  writes.push({ value, filters: [] });
  const q = { eq: (...args) => { writes.at(-1).filters.push(args); return q; }, not: () => q, select: () => q, maybeSingle: async () => ({ data: { slug: 'my-card' }, error: null }) }; return q;
} }) };
const actions = load('src/app/dashboard/employee/actions.ts', {
  'next/cache': { revalidatePath() {} },
  '@/lib/supabase/server': { getUser: async () => ({ user, supabase: reads }) },
  '@/lib/supabase/admin': { createAdminClient: () => admin },
});
const input = { full_name: 'Employee Name', job_title: 'Agent', phone: '+1 234', bio: 'Hello' };
assert.equal((await actions.updateEmployeeProfile(other, input)).ok, false, 'A colleague card cannot be edited');
assert.equal(writes.length, 0);
rpcError = { message: 'database failure' };
assert.equal((await actions.updateEmployeeProfile(own, input)).ok, false, 'RPC failure must fail closed');
rpcError = null;
user.email_confirmed_at = null;
assert.equal((await actions.updateEmployeeProfile(own, input)).ok, false, 'Unverified email cannot edit');
user.email_confirmed_at = '2026-01-01';
cardEmail = 'new-employee@example.com';
assert.equal((await actions.updateEmployeeProfile(own, input)).ok, false, 'Reassignment during the request revokes access');
cardEmail = 'Employee@Example.com';
assert.equal((await actions.updateEmployeeProfile(own, { ...input, user_id: 'attacker', company_id: 'other', email: 'attacker@example.com', published: false, accent: '#000000' })).ok, true);
assert.deepEqual(Object.keys(writes[0].value).sort(), ['bio', 'full_name', 'job_title', 'phone', 'updated_at']);
assert.ok(writes[0].filters.some(([key, value]) => key === 'id' && value === own));
assert.ok(writes[0].filters.some(([key, value]) => key === 'email' && value === cardEmail), 'Write guards against concurrent reassignment');
user = null;
assert.equal((await actions.updateEmployeeProfile(own, input)).ok, false);

// Render the server page with a query mock that rejects any unscoped private query.
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const queries = [];
const cards = [{ id: own, full_name: 'Employee Name', company: 'Agency', slug: 'my-card', published: true }];
const scopedDb = { from(table) {
  const query = { table, ids: null }; queries.push(query);
  const q = { select: () => q, in: (field, values) => { assert.equal(field, 'card_id'); query.ids = values; return q; }, order: () => q, range: async () => {
    assert.deepEqual(query.ids, [own], 'Private queries must use only employee card IDs');
    return { data: table === 'leads' ? [{ id: 'lead', card_id: own, name: 'Own lead', email: 'lead@example.com', created_at: '2026-01-01' }] : [{ id: 'booking', card_id: own, name: 'Own booking', email: 'guest@example.com', starts_at: '2026-01-01T10:00:00Z', ends_at: '2026-01-01T11:00:00Z', status: 'confirmed' }], error: null };
  } }; return q;
} };
const { loadListRows } = load('src/lib/list-data.ts', {});
const { default: Page } = load('src/app/dashboard/employee/page.tsx', {
  'next/link': { default: ({ children }) => React.createElement('a', null, children), __esModule: true },
  'next/navigation': { redirect: () => { throw Error('redirect'); } },
  '@/lib/employee': { getEmployeeWorkspace: async () => ({ user: { id: 'employee' }, supabase: scopedDb, cards }) },
  '@/lib/list-data': { loadListRows }, '@/lib/utils': { formatDate: () => 'Jan 1' },
  './EmployeeProfileForm': { EmployeeProfileForm: () => null },
});
const html = renderToStaticMarkup(await Page());
assert.ok(html.includes('Own lead'));
assert.ok(html.includes('Own booking'));
assert.equal(queries.length, 2);
cards.length = 0; queries.length = 0;
renderToStaticMarkup(await Page());
assert.equal(queries.length, 0, 'No membership must never trigger an unfiltered private query');
console.log('Employee access tests passed: authorization, reassignment, field restrictions and private query scope.');
