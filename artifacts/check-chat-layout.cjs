const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const { chromium } = require('C:/Users/Jupal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve('artifacts/chat-layout');
fs.mkdirSync(out, { recursive: true });
const messages = Array.from({ length: 30 }, (_, i) => ({ id: `fixture-${i}`, role: i % 2 ? 'assistant' : 'user', content: 'A longer conversation to verify the typing area stays visible.' }));
const mocks = {
  react: { ...React, useState: initial => React.useState(Array.isArray(initial) && initial.length === 0 ? messages : initial) },
  '@/lib/speech': { useSpeechSupport: () => ({ mic: true }), useSpeaker: () => ({ speak() {}, stop() {}, speakingId: null }), useRecorder: () => ({ recording: false, level: 0 }) },
};
const loaded = new Map();
function load(file) {
  if (loaded.has(file)) return loaded.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: id => mocks[id] ?? (id.startsWith('@/') ? load(`src/${id.slice(2)}.ts`) : require(id)), setTimeout, clearTimeout, console });
  loaded.set(file, mod.exports);
  return mod.exports;
}
(async () => {
  const { ChatPanel } = load('src/components/ChatWidget.tsx');
  const html = renderToStaticMarkup(React.createElement(ChatPanel, { slug: 'layout-test', ownerName: 'Test Owner', businessName: 'TapSynk', className: 'h-full rounded-t-[28px]', onClose() {} }));
  const css = await postcss([tailwind()]).process(fs.readFileSync('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') });
  fs.writeFileSync(path.join(out, 'chat.css'), css.css);
  fs.writeFileSync(path.join(out, 'chat.html'), `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="chat.css"></head><body><div style="height:92vh;width:100%;max-width:448px;margin:auto">${html}</div></body></html>`);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    for (const height of [844, 390]) {
      await page.setViewportSize({ width: 390, height });
      await page.goto(pathToFileURL(path.join(out, 'chat.html')).href);
      const input = page.locator('textarea');
      const box = await input.boundingBox();
      if (!box || box.y < 0 || box.y + box.height > height || box.width < 150) throw new Error(`Composer clipped at viewport ${height}: ${JSON.stringify(box)}`);
      await input.fill('The input is visible and usable.');
      await page.screenshot({ path: path.join(out, `chat-${height}.png`) });
      console.log(`PASS: ${height}px viewport, 30-message conversation, visible typing area ${JSON.stringify(box)}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
