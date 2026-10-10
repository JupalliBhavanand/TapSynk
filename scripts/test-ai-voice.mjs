import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const nodeRequire = createRequire(import.meta.url);
function load(file, mocks, globals = {}) {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { module: mod, exports: mod.exports, require: id => id in mocks ? mocks[id] : nodeRequire(id), process, Buffer, Intl, URL, ...globals });
  return mod.exports;
}
const requests = [];
let transcriptionResult;
const transcriptionRequests = [];
const provider = nodeRequire('@google/genai');
const gemini = load('src/lib/gemini.ts', {
  '@/lib/voice': { speechLanguage: language => Intl.getCanonicalLocales(language)[0] },
  'server-only': {}, '@/lib/env': { env: { geminiKey: () => 'test-key' } },
  '@google/genai': { ...provider, GoogleGenAI: class { models = { generateContent: async request => { transcriptionRequests.push(request); return { text: JSON.stringify(transcriptionResult) }; } }; interactions = { create: async (request, options) => {
    assert.equal(options.timeout, 18000);
    assert.equal(options.maxRetries, 0, "voice generation must not silently retry and prolong the handoff");
    requests.push(request);
    return { output_audio: { data: Buffer.from('test-audio').toString('base64'), mime_type: 'audio/mp3' } };
  } }; } },
});
for (const [transcript, language] of [['नमस्ते', 'hi'], ['Hola', 'es'], ['مرحبا', 'ar'], ['', 'und']]) {
  transcriptionResult = { transcript, language };
  const detected = await gemini.transcribe('audio', 'audio/webm');
  assert.equal(detected.transcript, transcript);
  assert.equal(detected.language, language === 'und' ? undefined : language);
}
assert.equal(transcriptionRequests[0].config.responseMimeType, 'application/json');
await gemini.synthesize('Hello, how can I help?', 'en-IN');
await gemini.synthesize('नमस्ते, मैं आपकी कैसे मदद कर सकती हूँ?');
await gemini.synthesize('مرحبا، كيف يمكنني مساعدتك؟');
await gemini.synthesize('Olá, como posso ajudar?', 'pt-BR');
for (const request of requests) {
  assert.equal(request.generation_config.speech_config[0].voice, gemini.GEMINI_VOICE);
  assert.equal(request.generation_config.seed, 42);
  assert.ok(request.input[0].content[0].annotations[0].style.includes('native pronunciation'));
  assert.ok(request.input[0].content[0].annotations[0].style.includes('same speaker identity'));
}
assert.ok(requests[0].input[0].content[0].annotations[0].style.includes('en-IN'));
const { speechLanguage } = load('src/lib/voice.ts', { 'server-only': {}, '@/lib/env': {} });
assert.equal(speechLanguage('pt_br'), 'pt-BR');
assert.equal(speechLanguage('zh-TW'), 'zh-TW');
assert.equal(speechLanguage('not a locale'), 'en');

// Verify both chat transport modes carry the detected language into the agent and response.
const agentRequests = [];
const preparedReplies = [];
const { POST } = load('src/app/api/chat/[slug]/route.ts', {
  '@/lib/reply-audio': { prepareReplyAudio: (...args) => { preparedReplies.push(args); return new Promise(() => {}); } },
  '@/lib/booking-quota': { canBookAppointment: async () => true },
  '@/lib/appointment-mail': {},
  'next/server': { after() {}, NextResponse: { json: data => Response.json(data) } },
  '@/lib/agent': { chatMessageSchema: nodeRequire('zod').z.object({ role: nodeRequire('zod').z.enum(['user', 'assistant']), content: nodeRequire('zod').z.string() }), chatHistorySchema: nodeRequire('zod').z.array(nodeRequire('zod').z.any()), runAgent: async options => { agentRequests.push(options); options.onText?.('नमस्ते'); return { reply: 'नमस्ते', booked: false }; } },
  '@/lib/data': { getPublicCard: async () => ({ card: { id: 'card', published: true }, agent: {}, subscription: {} }) },
  '@/lib/gemini': { AUDIO_TYPES: ['audio/webm'], transcribe: async () => ({ transcript: 'आप कैसे हैं?', language: 'hi' }) },
  '@/lib/rate-limit': { rateLimit: async () => true }, '@/lib/source': {}, '@/lib/supabase/admin': {}, '@/lib/supabase/server': {},
  '@/lib/types': { hasAi: () => true }, '@/lib/utils': { clientIp: () => 'test' }, '@/lib/voice': { speakToken: () => 'token' },
}, { Response, TextEncoder, ReadableStream, AbortController, console });
for (const stream of [false, true]) {
  const response = await POST({ headers: new Headers(), json: async () => ({ messages: [], audio: { data: 'x'.repeat(100), mimeType: 'audio/webm' }, stream, voice: true }) }, { params: Promise.resolve({ slug: 'test' }) });
  const body = stream ? (await response.text()).trim().split('\n').map(line => JSON.parse(line)).at(-1) : await response.json();
  assert.equal(agentRequests.at(-1).replyLanguage, 'hi');
  assert.equal(agentRequests.at(-1).history.at(-1).content, 'आप कैसे हैं?');
  assert.equal(body.language, 'hi');
  assert.equal(preparedReplies.at(-1)[2], 'hi', 'voice preparation starts in the spoken language without blocking the text response');
}

// Exercise the actual speaker hook with fake browser audio and deterministic timers.
const timers = new Map();
let serial = 0;
let fetchHandler;
const audios = [];
let nativeVoiceCalls = 0;
class FakeAudio {
  currentTime = 0;
  preload = '';
  setAttribute() {}
  pause() {}
  play() { this.onplaying?.(); return Promise.resolve(); }
  constructor() { audios.push(this); }
}
class FakeURL extends URL {
  static createObjectURL() { return `blob:test-${++serial}`; }
  static revokeObjectURL() {}
}
const states = [];
const cleanup = [];
const speech = load('src/lib/speech.ts', {
  react: {
    useState(initial) { const index = states.length; states.push(initial); return [initial, value => { states[index] = value; }]; },
    useRef: value => ({ current: value }), useCallback: fn => fn,
    useEffect: fn => cleanup.push(fn()), useSyncExternalStore() {},
  }, '@/lib/stream-player': {}, '@/lib/pcm': {},
  '@/lib/voice-activity': {},
}, {
  Audio: FakeAudio, URL: FakeURL, window: { speechSynthesis: { cancel() {}, speak() { nativeVoiceCalls++; } } },
  navigator: { language: 'en-IN' },
  fetch: (...args) => fetchHandler(...args), DOMException, AbortController, AbortSignal,
  setTimeout: (fn, ms) => { const id = ++serial; timers.set(id, { fn, ms }); return id; },
  clearTimeout: id => timers.delete(id),
});
const speaker = speech.useSpeaker('test-card');
let resolveFetch;
fetchHandler = (_url, options) => { assert.equal(JSON.parse(options.body).language, "fr", "spoken language overrides English phone settings"); return new Promise(resolve => { resolveFetch = resolve; }); };
let completions = 0;
const playback = speaker.speak('reply', { text: 'Bonjour', language: 'fr', token: 'signed-token' }, success => { assert.equal(success, true); completions++; });
assert.ok([...timers.values()].some(timer => timer.ms === 20000), 'same voice request has a bounded deadline');
assert.equal(states[1], true, 'voice loading exposed separately from speaking');
resolveFetch({ ok: true, blob: async () => new Blob(['audio']) });
await playback;
assert.equal(states[1], false);
audios.at(-1).onended();
audios.at(-1).onended();
assert.equal(completions, 1, 'onDone fires once');
assert.equal(states[0], null);
fetchHandler = async () => { throw new Error('provider unavailable'); };
await speaker.speak('failed', { text: 'Hola', token: 'signed-token' }, success => { assert.equal(success, false, 'failed playback must not automatically reopen the microphone'); completions++; });
assert.equal(states[0], null, 'failed synthesis cannot leave the speaker stuck');
assert.match(states[2], /Tap Listen to retry/);
assert.equal(nativeVoiceCalls, 0, 'never changes to a device voice');
await speaker.speak('greeting', { text: 'Hello', audioUrl: 'https://example.com/greeting.mp3' }, () => completions++);
const watchdog = [...timers.values()].find(timer => timer.ms === 15000);
assert.ok(watchdog);
watchdog.fn();
assert.equal(states[0], null, 'stalled playback recovers');
assert.match(states[2], /stopped responding/);
cleanup.forEach(fn => fn?.());
console.log('PASS: one configured voice across languages; regional accents preserved; no device-voice fallback; failed and stalled playback recover.');
