import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks = {}, globals = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: key => key in mocks ? mocks[key] : require(key), Buffer, ...globals });
  return mod.exports;
}
const pcm = load('src/lib/pcm.ts');
const { safeRedirectPath } = load('src/lib/redirect.ts', {}, { URL });
for (const unsafe of ['https://other.test', '//other.test', '/\\other.test', '/\n/other.test', '/ path', undefined]) assert.equal(safeRedirectPath(unsafe), '/dashboard');
assert.equal(safeRedirectPath('/dashboard/appointments?filter=today#booking'), '/dashboard/appointments?filter=today#booking');
const decoder = new pcm.PcmDecoder();
assert.equal(decoder.decode(new Uint8Array([0])).length, 0);
assert.equal(decoder.decode(new Uint8Array([128, 255, 127]))[0], -1);
assert.equal(decoder.decode(new Uint8Array([0, 0]))[0], 0);
decoder.finish();
const broken = new pcm.PcmDecoder(); broken.decode(new Uint8Array([0]));
assert.throws(() => broken.finish(), /mid-sample/);
const wav = pcm.pcmWav([new Uint8Array([0, 128, 255, 127])]);
assert.equal(Buffer.from(wav).toString('ascii', 0, 4), 'RIFF');
assert.equal(new DataView(wav.buffer).getUint32(24, true), 24000);
assert.equal(new DataView(wav.buffer).getUint32(40, true), 4);

const sources = [];
class Context {
  state = 'running'; currentTime = 0; destination = {};
  resume() { return Promise.resolve(); }
  createBuffer(_channels, samples, rate) { return { duration: samples / rate, copyToChannel(data) { assert.equal(data.length, samples); } }; }
  createBufferSource() { const source = { connect() {}, disconnect() {}, start(time) { this.time = time; }, stop() { this.stopped = true; } }; sources.push(source); return source; }
}
const { StreamPlayer } = load('src/lib/stream-player.ts', { '@/lib/pcm': pcm });
let completions = 0;
const output = new StreamPlayer(new Context(), () => completions++, () => {});
output.push(new Uint8Array([0, 0, 1, 0]));
output.push(new Uint8Array([0, 0, 1, 0]));
assert.equal(sources[1].time, sources[0].time + sources[0].buffer.duration, 'packets share one continuous audio-clock timeline');
assert.equal(completions, 0, 'playback starts before the stream completes');
output.end(); sources[0].onended();
assert.equal(completions, 0, 'microphone cannot open while speech is queued');
sources[1].onended();
assert.equal(completions, 1);
const interrupted = new StreamPlayer(new Context(), () => completions++, () => {});
interrupted.push(new Uint8Array([0, 0])); interrupted.stop();
assert.equal(sources.at(-1).stopped, true);
assert.equal(sources.at(-1).onended, null, 'interrupting speech suppresses old completion callbacks');

// Provider preparation and HTTP subscribers share a single streaming render.
let resume;
let calls = 0;
const speech = load('src/lib/reply-audio.ts', {
  'server-only': {}, '@/lib/pcm': pcm,
  '@/lib/gemini': { GEMINI_VOICE: 'Kore', GEMINI_TTS_MODEL: 'test', GEMINI_SPEECH_STYLE: 'fixed', streamSpeech: async function* (_text, _language, signal) { calls++; yield Buffer.from([0, 0]); await new Promise(resolve => { resume = resolve; }); signal.throwIfAborted(); yield Buffer.from([1, 0]); } },
}, { AbortController, ReadableStream, Date });
const ready = speech.prepareReplyAudio('card', 'Hello', 'hi');
const reader = speech.streamReplyAudio('card', 'Hello', 'hi').getReader();
assert.equal((await reader.read()).value.length, 2, 'first audio reaches the client while generation is unfinished');
assert.equal(calls, 1);
resume();
assert.equal((await reader.read()).value.length, 2);
assert.equal((await reader.read()).done, true);
assert.equal((await ready).mimeType, 'audio/wav');
const replay = speech.streamReplyAudio('card', 'Hello', 'hi').getReader();
assert.equal((await replay.read()).value.length, 2);
assert.equal(calls, 1, 'Listen again does not synthesize another voice take');
await replay.cancel();

// Exercise the real client hook against a streaming HTTP response.
const states = []; const cleanup = []; const timers = new Map(); let timerId = 0;
let controller; let fetches = 0;
class Audio { pause() {} setAttribute() {} play() { this.onplaying?.(); return Promise.resolve(); } }
class BlobURL { static createObjectURL() { return 'blob:cached'; } static revokeObjectURL() {} }
const hook = load('src/lib/speech.ts', {
  react: { useState: value => { const index = states.length; states.push(value); return [value, next => { states[index] = next; }]; }, useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: fn => cleanup.push(fn()), useSyncExternalStore() {} },
  '@/lib/voice-activity': {}, '@/lib/pcm': pcm, '@/lib/stream-player': { StreamPlayer },
}, {
  window: { AudioContext: Context }, Audio, URL: BlobURL, Blob, AbortController, DOMException,
  setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
  fetch: async () => { fetches++; return { ok: true, headers: new Headers({ 'content-type': 'audio/l16; rate=24000; channels=1' }), body: new ReadableStream({ start(value) { controller = value; } }) }; },
});
const speaker = hook.useSpeaker('card'); let done = 0;
const pending = speaker.speak('reply', { text: 'Hello', token: 'token', language: 'hi' }, success => { assert.equal(success, true); done++; });
for (let i = 0; i < 8; i++) await Promise.resolve();
const before = sources.length;
controller.enqueue(new Uint8Array([0, 0, 1, 0]));
for (let i = 0; i < 8; i++) await Promise.resolve();
assert.equal(sources.length, before + 1, 'the client schedules speech without waiting for response.blob()');
assert.equal(states[1], false, 'loading indicator ends when the first audio is queued');
controller.enqueue(new Uint8Array([0, 0])); controller.close();
await pending;
assert.equal(done, 0);
sources[before].onended(); sources[before + 1].onended();
assert.equal(done, 1);
assert.equal(fetches, 1);
await speaker.speak('reply', { text: 'Hello', token: 'token', language: 'hi' });
assert.equal(fetches, 1, 'replay uses the cached complete recording');
cleanup.forEach(fn => fn?.());
console.log('PASS: fragmented PCM; continuous scheduling; first-chunk playback before generation finishes; one provider render; cancellation; cached replay; microphone handoff after actual playback.');
