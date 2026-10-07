import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const nodeRequire = createRequire(import.meta.url);
const { NextRequest, NextResponse } = nodeRequire('next/server');

// Load the actual TypeScript sources without adding a test framework. Route
// dependencies are stubbed so no database, account or payment setup is needed.
const cache = new Map();
function load(relative, mocks = {}) {
  const filename = path.resolve(relative);
  if (!Object.keys(mocks).length && cache.has(filename)) return cache.get(filename);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (id) => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`);
    return nodeRequire(id);
  };
  vm.runInNewContext(source, { module: loadedModule, exports: loadedModule.exports, require: localRequire, Buffer, URL, AbortSignal, fetch, process }, { filename });
  if (!Object.keys(mocks).length) cache.set(filename, loadedModule.exports);
  return loadedModule.exports;
}

const { buildVCard } = load('src/lib/vcard.ts');
const card = {
  slug: 'priya-sharma', full_name: 'Priya शर्मा', company: 'Studio, Lumen; Design',
  job_title: 'Architect', phone: '+91 98765 43210', email: 'priya@example.com',
  website: 'https://example.com', address: 'Mumbai',
  bio: 'Line one\rLine two\n' + '日本語🌟'.repeat(80),
  avatar_url: 'not a valid URL', published: true, socials: { instagram: '@priya' },
};
const photo = { base64: Buffer.alloc(4096, 42).toString('base64'), type: 'JPEG' };
const vcf = buildVCard(card, 'https://example.com/c/priya-sharma', photo);
assert.ok(vcf.endsWith('END:VCARD\r\n'), 'vCard must terminate with CRLF');
assert.ok(!/(?<!\r)\n|\r(?!\n)/.test(vcf), 'only CRLF physical line endings');
for (const line of vcf.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, 'folded UTF-8 lines');
const unfolded = vcf.replace(/\r\n /g, '');
assert.ok(unfolded.includes(`FN:${card.full_name}\r\n`), 'Unicode contact name preserved');
assert.ok(unfolded.includes('ORG:Studio\\, Lumen\\; Design\r\n'));
assert.ok(unfolded.includes('NOTE:Line one\\nLine two\\n' + '日本語🌟'.repeat(80)));
assert.ok(unfolded.includes(`PHOTO;ENCODING=b;TYPE=JPEG:${photo.base64}\r\n`), 'photo survives unfolding');
assert.ok(unfolded.includes('TEL;TYPE=CELL:+91 98765 43210\r\n'));
assert.ok(unfolded.includes('X-SOCIALPROFILE;TYPE=instagram:https://www.instagram.com/priya\r\n'));

async function testRoute() {
  let found = { card, subscription: { status: 'active' } };
  let lookedUp;
  const events = [];
  const afterTasks = [];
  const previousStorage = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://storage.example.com';
  try {
    const { GET } = load('src/app/api/vcard/[slug]/route.ts', {
      'next/server': { NextResponse, after: (fn) => afterTasks.push(fn) },
      '@/lib/data': { getPublicCard: async (slug) => { lookedUp = slug; return found; } },
      '@/lib/env': { REQUIRE_SUBSCRIPTION: true, SITE_URL: 'https://example.com' },
      '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async (_, args) => events.push(args) }) },
      '@/lib/types': { isActive: (s) => s?.status === 'active' },
    });
    const context = (slug) => ({ params: Promise.resolve({ slug }) });
    const response = await GET(new NextRequest('https://example.com/api/vcard/priya-sharma.vcf?s=q'), context('priya-sharma.vcf'));
    assert.equal(response.status, 200, 'malformed optional avatar must not break contact export');
    assert.equal(lookedUp, 'priya-sharma');
    assert.match(response.headers.get('content-disposition'), /^inline; filename=".+\.vcf"$/);
    assert.equal(response.headers.get('content-type'), 'text/vcard; charset=utf-8');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok((await response.text()).includes('END:VCARD\r\n'));
    await Promise.all(afterTasks.splice(0).map((fn) => fn()));
    assert.equal(events[0].p_slug, 'priya-sharma');
    assert.equal(events[0].p_source, 'qr');
    const download = await GET(new NextRequest('https://example.com/api/vcard/priya-sharma.vcf?download=1'), context('priya-sharma.vcf'));
    assert.match(download.headers.get('content-disposition'), /^attachment;/);
    const legacy = await GET(new NextRequest('https://example.com/api/vcard/priya-sharma'), context('priya-sharma'));
    assert.equal(legacy.status, 200, 'old contact links still work');
    for (const unavailable of [null, { card: { ...card, published: false }, subscription: { status: 'active' } }, { card, subscription: { status: 'canceled' } }]) {
      found = unavailable;
      const response = await GET(new NextRequest('https://example.com/api/vcard/priya-sharma.vcf'), context('priya-sharma.vcf'));
      assert.equal(response.status, 404, 'visibility and subscription checks preserved');
    }
    console.log('PASS: UTF-8 vCard folding, photo round-trip, line endings, iPhone inline response, download fallback, legacy links, malformed avatar, visibility and analytics.');
  } finally {
    if (previousStorage === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousStorage;
  }
}
testRoute().catch((error) => { console.error(error); process.exitCode = 1; });
