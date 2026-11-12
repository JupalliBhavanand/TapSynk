import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import assert from 'node:assert/strict';
function load(path, imports, globals={}) {
 const loadedModule={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module: loadedModule,exports:loadedModule.exports,require:name=>imports[name],URL,URLSearchParams,Buffer,Response,process,AbortSignal,...globals});
 return loadedModule.exports;
}
const lib=load('src/lib/email-signature.ts',{});
let fetches=0;
const route=load('src/app/api/signature-portrait/route.ts',{'sharp':sharp,'@/lib/email-signature':lib,'next/server':{}},{fetch:()=>{fetches++;throw Error('Should not fetch');}});
for(const t of lib.signatureTemplates){
 const response=await route.GET({nextUrl:new URL('https://example.com/api/signature-portrait?'+new URLSearchParams({src:'https://127.0.0.1/private',initials:'<>&',theme:t.id,color:t.color.slice(1)}))});
 assert.equal(response.status,200);
 const png=Buffer.from(await response.arrayBuffer());
 const meta=await sharp(png).metadata();
 assert.equal(meta.width,380);assert.equal(meta.height,468);assert.equal(meta.format,'png');
 assert.ok(meta.hasAlpha, 'Portrait artwork retains transparent cutouts');
}
assert.equal(fetches,0,'Untrusted URLs never fetched');
console.log('Signature portraits: four PNG palettes, transparent cutouts, escaped initials, and blocked remote sources passed.');

const source = await sharp({create:{width:600,height:100,channels:4,background:'#ff0000'}}).png().toBuffer();
const goodRoute=load('src/app/api/signature-portrait/route.ts',{'sharp':sharp,'@/lib/email-signature':lib,'next/server':{}},{process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://storage.example'}},fetch:async()=>new Response(source,{headers:{'content-type':'image/png'}})});
const designs = new Set();
for (const design of ['diagonal','arch','rounded','plain']) {
 const result = await goodRoute.GET({nextUrl:new URL('https://app.example/api/signature-portrait?'+new URLSearchParams({src:'https://storage.example/storage/v1/object/public/card-assets/user/photo.png',design}))});
 const png=Buffer.from(await result.arrayBuffer()); designs.add(png.toString('base64'));
 const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(const x of [41,338]) { const offset=(234*info.width+x)*4; assert.equal(data[offset],255); assert.equal(data[offset+1],0); assert.equal(data[offset+3],255,'Full photo edges stay visible'); }
}
assert.equal(designs.size,4,'Four distinct photo designs');
console.log('Photo design checks: full wide upload preserved in diagonal, arch, rounded, and plain styles.');
