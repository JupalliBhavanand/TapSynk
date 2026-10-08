import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const nodeRequire = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { module: mod, exports: mod.exports, require: (id) => id in mocks ? mocks[id] : nodeRequire(id), Date, Intl, console });
  return mod.exports;
}
const { VoiceActivity } = load('src/lib/voice-activity.ts');
function sample(levels) {
  const detector = new VoiceActivity();
  for (let i = 0; i < levels.length; i++) detector.update(levels[i], (i + 1) * 20, 20);
  return detector;
}
assert.equal(sample(Array(100).fill(0)).heard, false, 'silence rejected');
assert.equal(sample(Array(100).fill(0.04)).heard, false, 'steady loud ambient noise rejected');
assert.equal(sample([...Array(20).fill(0.004), 0.2, 0.2, ...Array(80).fill(0.004)]).heard, false, 'short impact noise rejected');
const voice = sample([...Array(20).fill(0.004), ...Array(30).fill(0.08), ...Array(40).fill(0.004)]);
assert.equal(voice.heard, true, 'sustained foreground voice accepted');
assert.ok(voice.firstVoiceMs >= 250 && voice.lastVoiceMs <= 1000, 'speech boundaries exclude surrounding silence');

const { GenerateContentResponse } = nodeRequire('@google/genai');
const response = (parts, finishReason) => Object.assign(new GenerateContentResponse(), { candidates: [{ content: { role: 'model', parts }, finishReason }] });
const delta = [];
const model = { models: { async *generateContentStream(params) {
  assert.equal(params.config.maxOutputTokens, 768);
  yield response([{ text: 'Internal reasoning', thought: true, thoughtSignature: 'signature' }]);
  yield response([{ text: 'Hello ' }]);
  yield response([{ text: 'there.' }], 'STOP');
} } };
const { runAgent } = load('src/lib/agent.ts', {
  'server-only': {}, '@/lib/gemini': { gemini: () => model, GEMINI_MODEL: 'test', LOW_THINKING: {} },
  '@/lib/slots': { isValidTimeZone: () => true }, '@/lib/supabase/admin': {},
});
const result = await runAgent({
  card: { full_name: 'Test Owner', company: 'Test', email: 'test@example.com' },
  agent: { tone: 'friendly', timezone: 'UTC', booking_enabled: false },
  history: [{ role: 'user', content: 'Hello' }], canBook: async () => true,
  onText: (text, reset) => delta.push({ text, reset }),
});
assert.equal(result.reply, 'Hello there.');
assert.equal(delta.filter((d) => !d.reset).map((d) => d.text).join(''), 'Hello there.', 'no private thought text streamed');
assert.equal(delta[0].reset, true);
let turns = 0;
model.models.generateContentStream = async function* (params) {
  turns++;
  if (turns === 1) {
    yield response([{ functionCall: { name: 'get_available_slots', args: { date: 'invalid' }, id: 'call-1' }, thoughtSignature: 'tool-signature' }]);
  } else {
    const modelTurn = params.contents.find((c) => c.parts?.some((p) => p.functionCall));
    assert.equal(modelTurn.parts[0].thoughtSignature, 'tool-signature', 'tool signatures preserved across stream');
    const toolResult = params.contents.at(-1).parts[0].functionResponse;
    assert.equal(toolResult.id, 'call-1');
    assert.equal(toolResult.response.error, 'Use YYYY-MM-DD.');
    yield response([{ text: 'Which date would you like?' }], 'STOP');
  }
};
const bookingReply = await runAgent({ card: { full_name: 'Test' }, agent: { tone: 'friendly', timezone: 'UTC', booking_enabled: true }, history: [{ role: 'user', content: 'Book a meeting' }], canBook: async () => true, onText() {} });
assert.equal(turns, 2);
assert.equal(bookingReply.reply, 'Which date would you like?');
console.log('PASS: silence, steady noise and impact gating; foreground speech; streamed reply assembly; private reasoning filtered.');
