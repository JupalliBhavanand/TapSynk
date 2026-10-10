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
let clock = 0;
let renders = 0;
const audio = load('src/lib/reply-audio.ts', { 'server-only': {}, '@/lib/pcm': load('src/lib/pcm.ts'), '@/lib/gemini': { GEMINI_VOICE: 'Kore', GEMINI_TTS_MODEL: 'test', GEMINI_SPEECH_STYLE: 'steady', streamSpeech: async function* (text) { renders++; if (text === 'fail') throw new Error('provider'); yield Buffer.from([0, 0, 1, 0]); } } }, { Date: { now: () => clock }, AbortController, ReadableStream });
const first = audio.prepareReplyAudio('card', 'Hello', 'en');
assert.equal(audio.prepareReplyAudio('card', 'Hello', 'en'), first, 'preparation and playback share an in-flight render');
await first;
await audio.prepareReplyAudio('card', 'Hello', 'en');
assert.equal(renders, 1, 'Listen again reuses rendered audio');
await audio.prepareReplyAudio('other-card', 'Hello', 'en');
await audio.prepareReplyAudio('card', 'Hello', 'hi');
assert.equal(renders, 3, 'card and language are isolated');
clock = 120001;
await audio.prepareReplyAudio('card', 'Hello', 'en');
assert.equal(renders, 4, 'expired audio is regenerated');
await assert.rejects(audio.prepareReplyAudio('card', 'fail'));
await assert.rejects(audio.prepareReplyAudio('card', 'fail'));
assert.equal(renders, 6, 'failed renders can be retried');

const { VoiceActivity } = load('src/lib/voice-activity.ts');
const short = new VoiceActivity(0.004);
for (let i = 1; i <= 15; i++) short.update(0.08, i * 20, 20);
assert.equal(short.heard, true, 'a short immediate answer works with warm noise calibration');
assert.equal(short.pauseMs, 650);
for (let i = 16; i <= 65; i++) short.update(0.08, i * 20, 20);
assert.equal(short.pauseMs, 1000);
for (let i = 66; i <= 120; i++) short.update(0.08, i * 20, 20);
assert.equal(short.pauseMs, 1200, 'long explanations get more time to pause');

// Exercise the actual recorder: retain only the microphone during an active call,
// disconnect recording between turns, release everything when the call ends.
const processors = [];
const cleanups = [];
let mediaRequests = 0;
let stopped = 0;
let time = 0;
const streams = [];
function stream() {
  const track = { readyState: 'live', stop() { this.readyState = 'ended'; stopped++; } };
  const value = { getTracks: () => [track], getAudioTracks: () => [track] };
  streams.push(value);
  return value;
}
let getMedia = async () => { mediaRequests++; return stream(); };
const node = () => ({ connect() {}, disconnect() {}, frequency: { value: 0 } });
class FakeAudioContext {
  sampleRate = 16000;
  destination = {};
  resume() { return Promise.resolve(); }
  createMediaStreamSource() { return node(); }
  createBiquadFilter() { return node(); }
  createScriptProcessor() { const value = node(); processors.push(value); return value; }
}
const speech = load('src/lib/speech.ts', {
  react: { useState: value => [value, () => {}], useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: fn => cleanups.push(fn()), useSyncExternalStore() {} },
  '@/lib/stream-player': {}, '@/lib/pcm': {},
  '@/lib/voice-activity': { VoiceActivity },
}, { window: { AudioContext: FakeAudioContext }, navigator: { mediaDevices: { getUserMedia: (...args) => getMedia(...args) } }, performance: { now: () => time }, DOMException, btoa: value => Buffer.from(value, 'binary').toString('base64') });
const recorder = speech.useRecorder();
const clips = [];
function frames(count, rms) {
  for (let i = 0; i < count; i++) {
    time += 64;
    processors.at(-1).onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(1024).fill(rms) } });
  }
}
await recorder.start({ continuous: true, onDone: clip => clips.push(clip) });
frames(8, 0.004); frames(10, 0.08); frames(20, 0.004);
assert.equal(clips.length, 1);
assert.equal(clips[0].mimeType, 'audio/wav');
assert.equal(stopped, 0, 'the microphone stays ready between call turns');
assert.equal(processors.at(-1).onaudioprocess, null, 'AI playback is not recorded');
await recorder.start({ continuous: true, onDone: clip => clips.push(clip) });
assert.equal(mediaRequests, 1, 'next turn does not reopen the device');
frames(5, 0.08);
recorder.stop();
assert.ok(clips[1], 'an immediate brief second-turn answer is captured');
recorder.cancel();
assert.equal(stopped, 1, 'ending the call releases the microphone');
await recorder.start({ onDone: clip => clips.push(clip) });
recorder.stop();
assert.equal(mediaRequests, 2);
assert.equal(stopped, 2, 'ordinary push-to-talk releases the device after recording');
let permission;
getMedia = () => new Promise(resolve => { permission = resolve; });
const pending = recorder.start({ continuous: true, onDone() {} });
recorder.cancel();
permission(stream());
await pending;
assert.equal(stopped, 3, 'ending a call while permission is pending releases its late stream');
cleanups.forEach(fn => fn?.());
console.log('PASS: early audio preparation and deduplication; adaptive pauses; immediate short answers; warm call microphone; no recording during playback; cleanup and permission cancellation.');
