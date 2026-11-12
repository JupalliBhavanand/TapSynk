import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(fs.readFileSync('src/lib/email-signature.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const loadedModule = { exports: {} };
vm.runInNewContext(compiled, { exports: loadedModule.exports, module: loadedModule, URL, URLSearchParams });
const { buildEmailSignature, defaultSignatureSettings, signatureTemplates, signatureUrl } = loadedModule.exports;
const card = { full_name: 'Alex <script>alert(1)</script>', job_title: 'Founder & Director', company: 'Forma Studio', email: 'alex@example.com', phone: '+1 415 555 0123', accent: '#5654d9', avatar_url: 'https://example.com/portrait.jpg', logo_url: 'https://example.com/logo.png', website: 'example.com', socials: { linkedin: 'https://linkedin.com/in/alex', instagram: 'javascript:alert(1)' } };
const layouts = new Set();
for (const template of signatureTemplates) {
  const settings = { ...defaultSignatureSettings, template: template.id, color: template.color, cta: 'Meet & connect' };
  const result = buildEmailSignature(card, 'https://example.com/c/alex', settings);
  layouts.add(result.html);
  assert.ok(result.html.includes('Alex &lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(result.html.includes('Founder &amp; Director'));
  assert.ok(result.html.includes('Meet &amp; connect'));
  assert.ok((result.html.match(/<a /g) || []).length >= 7, 'Profile, contact, website and social links are separate');
  assert.ok(result.html.includes('href="mailto:alex@example.com"'));
  assert.ok(result.html.includes('href="tel:+14155550123"'));
  assert.ok(result.html.includes('href="https://linkedin.com/in/alex"'));
  assert.ok(result.html.includes('href="https://example.com/"'));
  assert.ok(result.html.includes('width="440"'));
  assert.ok(!result.html.includes('width="600"'));
  let depth = 0;
  for (const tag of result.html.matchAll(/<\/?a(?:\s[^>]*)?>/g)) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    assert.ok(depth >= 0 && depth <= 1, 'Links must not be nested');
  }
  assert.equal(depth, 0);
  assert.ok(result.html.includes('href="https://example.com/c/alex"'));
  assert.ok(!result.html.includes('javascript:'));
  assert.ok(!result.html.includes('<script>'));
  assert.ok(!result.html.includes('animation:'), 'Export does not depend on CSS animations');
  assert.ok(result.html.includes('data-signature-part="portrait"'));
  assert.ok(result.html.includes('/api/signature-portrait?'));
  assert.ok(result.html.includes('/signature/linkedin'));
  assert.ok(!result.html.includes('clip-path'), 'Email markup uses PNG artwork rather than unsupported CSS clipping');
  assert.ok(result.plain.includes(card.email));
  const hidden = buildEmailSignature(card, 'https://example.com/c/alex', { ...settings, portrait: false, socials: false });
  assert.ok(!hidden.html.includes('portrait.jpg'));
  assert.ok(!hidden.html.includes('linkedin.com'));
  assert.ok(!hidden.plain.includes('linkedin.com'));
  assert.ok(hidden.html.includes('alex@example.com'));
  const compact = buildEmailSignature(card, 'https://example.com/c/alex', { ...settings, compact: true });
  assert.notEqual(compact.html, result.html);
  assert.ok(compact.html.includes('width="380"'));
}
assert.equal(layouts.size, 4, 'Four distinct exported layouts');
assert.equal(signatureUrl('data:text/html,test'), '');
assert.equal(signatureUrl('javascript:alert(1)'), '');
assert.equal(signatureUrl('example.com'), 'https://example.com/');
assert.equal(buildEmailSignature({ ...card, accent: 'red;position:fixed' }, 'https://example.com', { ...defaultSignatureSettings, color: '' }).accent, '#5654d9');
console.log('Email signature: four layouts, customization, escaping, links, and export checks passed.');

const { signaturePreviewHtml } = loadedModule.exports;
const exported = buildEmailSignature(card, 'https://public.example/c/alex', defaultSignatureSettings).html;
const preview = signaturePreviewHtml(exported);
assert.ok(preview.includes('src="/api/signature-portrait?'));
assert.ok(preview.includes('src="/signature/web.png"'));
assert.ok(preview.includes('href="https://public.example/c/alex"'));
assert.ok(exported.includes('src="https://public.example/api/signature-portrait?'));
assert.ok(!preview.includes('api/signature-motion'), 'Reference layout has no extra broken-image accent');
assert.ok(preview.includes('title="Save my contact"'));
console.log('Preview assets use the running app; exported assets and profile links remain absolute.');
