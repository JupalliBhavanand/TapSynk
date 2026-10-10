import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Jupal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.READINESS_BASE_URL || 'http://localhost:3100';
const output = path.resolve('artifacts/readiness');
fs.mkdirSync(output, { recursive: true });
(async () => {
 const failures = []; const results = [];
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const routes = ['/', '/pricing', '/demo', '/privacy', '/terms', '/login', '/signup', '/forgot-password', '/reset-password'];
  let slug = process.env.READINESS_CARD_SLUG;
  if (!slug && process.env.SUPABASE_SERVICE_ROLE_KEY) {
   const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
   const { data } = await db.from('cards').select('slug').eq('email', 'bhavanandjupalli@gmail.com').eq('published', true).limit(1);
   slug = data?.[0]?.slug;
  }
  if (slug) routes.push('/c/' + slug);
  for (const width of [390, 1440]) {
   await page.setViewportSize({ width, height: 844 });
   for (const route of routes) {
    const before = errors.length;
    const response = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 20000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    const ok = response.status() === 200 && !overflow && errors.length === before;
    results.push({ route, width, status: response.status(), overflow, runtimeErrors: errors.slice(before), ok });
    if (!ok) failures.push(route + ' at ' + width);
    if (width === 390 && ['/', '/pricing'].includes(route)) await page.screenshot({ path: path.join(output, route === '/' ? 'home-mobile.png' : 'pricing-mobile.png'), fullPage: true });
   }
  }
  for (const route of ['/dashboard', '/dashboard/appointments', '/dashboard/company', '/dashboard/billing']) {
   await page.goto(base + route, { waitUntil: 'domcontentloaded' });
   const ok = new URL(page.url()).pathname === '/login';
   results.push({ route, protected: true, ok }); if (!ok) failures.push(route + ' authentication');
  }
  await page.goto(base + '/signup');
  const email = page.locator('input[type=email]').first(); await email.fill('invalid-email');
  const invalidRejected = !(await email.evaluate(input => input.checkValidity()));
  results.push({ check: 'signup invalid-email validation', ok: invalidRejected });
  if (!invalidRejected) failures.push('signup validation');
  for (const [route, method, expected] of [
   ['/api/demo', 'POST', 400], ['/api/chat/missing-card', 'POST', 400], ['/api/chat/missing-card/speak', 'POST', 400],
   ['/api/stripe/checkout', 'POST', 401], ['/api/ai/learn', 'POST', 401], ['/api/leads/export', 'GET', 307], ['/api/vcard/missing-card', 'GET', 404],
  ]) {
   const response = await fetch(base + route, { method, redirect: 'manual', ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: '{}' } : {}) });
   const ok = response.status === expected;
   results.push({ route, method, status: response.status, expected, ok }); if (!ok) failures.push(route + ' validation/access');
  }
  fs.writeFileSync(path.join(output, 'website-smoke.json'), JSON.stringify({ results, failures }, null, 2));
  console.log(JSON.stringify({ checks: results.length, failed: failures }));
  if (failures.length) process.exitCode = 1;
 } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
