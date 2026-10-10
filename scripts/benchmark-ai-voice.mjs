import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
if (!process.argv.includes('--live')) { console.log('Use node --env-file=.env scripts/benchmark-ai-voice.mjs --live to measure the configured provider.'); process.exit(0); }
function library() {
 const mod = { exports: {} };
 const code = ts.transpileModule(fs.readFileSync('src/lib/gemini.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const mocks = {'server-only':{},'@/lib/env':{env:{geminiKey:()=>process.env.GEMINI_API_KEY}},'@/lib/voice':{speechLanguage:language=>language}};
 vm.runInNewContext(code,{module:mod,exports:mod.exports,require:key=>key in mocks?mocks[key]:require(key),process,Buffer,AbortSignal});
 return mod.exports;
}
const result = [];
for (const model of [process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']) {
 process.env.GEMINI_TTS_MODEL = model;
 const voice = library();
 const started = performance.now();
 let first;
 let bytes = 0;
 try {
  for await (const chunk of voice.streamSpeech('Hello. How can I help you today?', 'en-IN')) { first ??= performance.now()-started; bytes+=chunk.length; }
  result.push({model,ok:true,firstAudioMs:Math.round(first),completeAudioMs:Math.round(performance.now()-started),audioBytes:bytes});
 } catch(error) { result.push({model,ok:false,elapsedMs:Math.round(performance.now()-started),status:error.status,name:error.name}); }
 console.log(JSON.stringify(result.at(-1)));
}
fs.mkdirSync('artifacts/readiness',{recursive:true});
fs.writeFileSync('artifacts/readiness/voice-latency.json',JSON.stringify(result,null,2));
