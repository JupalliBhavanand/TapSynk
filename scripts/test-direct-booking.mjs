import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,mocks={},globals={}){const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const mod={exports:{}};vm.runInNewContext(out,{module:mod,exports:mod.exports,require:n=>n in mocks?mocks[n]:require(n),URL,Date,Intl,console,...globals});return mod.exports;}
const socials=load('src/lib/socials.ts');
for(const url of ['https://g.page/r/example/review','https://search.google.com/local/writereview?placeid=example','https://maps.app.goo.gl/example'])assert.equal(socials.socialHref('google_review',url),url);
for(const url of ['javascript:alert(1)','https://google.com.evil.example/review','https://user@google.com/review','@handle','http://g.page/r/example/review'])assert.equal(socials.socialHref('google_review',url),'');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const utils=load('src/lib/utils.ts');
const {socialsSchema}=load('src/lib/schemas.ts',{'@/lib/slots':{isValidTimeZone:()=>true},'@/lib/socials':socials,'@/lib/utils':utils});
assert.equal(socialsSchema.parse({google_review:'https://g.page/r/example/review'}).google_review,'https://g.page/r/example/review');
assert.equal(socialsSchema.safeParse({google_review:'https://evil.test/review'}).success,false);
const icons=load('src/components/BrandIcons.tsx');
const {ProfileCard}=load('src/components/ProfileCard.tsx',{'@/lib/socials':socials,'@/lib/utils':utils,'@/components/BrandIcons':icons});
const profile=renderToStaticMarkup(React.createElement(ProfileCard,{card:{full_name:'Host',website:'',accent:'#1d5bff',socials:{google_review:'https://g.page/r/example/review'}}}));
assert.ok(profile.includes('aria-label="Google reviews"'));assert.ok(profile.includes('data-profile-link="social:google_review"'));
const {DirectBookingForm}=load('src/components/DirectBookingForm.tsx');
const form=renderToStaticMarkup(React.createElement(DirectBookingForm,{slug:'test-card',source:'tap',onClose(){}}));
for(const text of ['Book an appointment','name="name"','name="email"','type="date"','Confirm appointment'])assert.ok(form.includes(text));
const slots=load('src/lib/slots.ts');let queryError=null;const filters=[];
const db={from:()=>({select(){return this;},eq(...args){filters.push(args);return this;},gte(){return this;},lt:async()=>({data:[],error:queryError})})};
const booking=load('src/lib/public-booking.ts',{'server-only':{},'@/lib/slots':slots,'@/lib/supabase/admin':{createAdminClient:()=>db}});
const now=new Date('2026-11-19T02:00:00Z');
assert.equal(booking.bookingDate(now,'America/Los_Angeles'),'2026-11-18');
assert.equal(booking.validBookingDate('2026-02-30','UTC',now),false);
assert.equal(booking.validBookingDate('2026-11-18','America/Los_Angeles',now),true);
assert.equal(booking.validBookingDate('2027-12-01','UTC',now),false);
queryError={code:'down'};await assert.rejects(booking.publicBookingSlots({id:'card'},{},'2026-11-20'));assert.ok(filters.some(([key,val])=>key==='card_id'&&val==='card'));

let found={card:{id:'card',user_id:'owner',slug:'test-card',published:true,full_name:'Host',email:'host@example.com'},agent:{booking_enabled:true,slot_minutes:30,timezone:'UTC',business_name:'Business'},subscription:{status:'active',tier:'ai'}};
const slot=new Date(Date.now()+2*86400e3).toISOString();let open=[slot],quota=true,allowed=true,insertError=null,inserts=[],queued=[],deliveries=[];
const route=load('src/app/api/appointments/[slug]/route.ts',{
 'next/server':{NextResponse:{json:(v,o)=>Response.json(v,o)},after:fn=>queued.push(fn)},'@/lib/data':{getPublicCard:async()=>found},'@/lib/types':{hasAi:s=>s?.status==='active'&&s?.tier==='ai'},'@/lib/rate-limit':{rateLimit:async()=>allowed},'@/lib/utils':{clientIp:()=> 'test'},
 '@/lib/public-booking':{...booking,publicBookingSlots:async()=>open},'@/lib/booking-quota':{canBookAppointment:async()=>quota},'@/lib/business-identity':{businessIdentity:()=> 'Business'},'@/lib/booking-delivery':{deliverBookedMeeting:async(...args)=>deliveries.push(args)},'@/lib/appointment-mail':{mailConfigurationError:()=>undefined},'@/lib/source':{parseSource:()=> 'tap'},
 '@/lib/supabase/admin':{createAdminClient:()=>({from:table=>({insert:row=>{assert.equal(table,'appointments');inserts.push(row);return {select:()=>({single:async()=>({data:insertError?null:{id:'appointment'},error:insertError})})};}}),rpc:async()=>({})})},
},{Request,Response});
const ctx={params:Promise.resolve({slug:'test-card'})};
const payload={name:'Visitor',email:'VISITOR@example.com',slot,source:'tap'};
const req=(body=payload,origin='https://tapsynk.test')=>new Request('https://tapsynk.test/api/appointments/test-card',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
assert.equal((await route.POST(req(),ctx)).status,201);assert.equal(inserts.length,1);assert.equal(inserts[0].owner_id,'owner');assert.equal(inserts[0].email,'visitor@example.com');assert.equal(Date.parse(inserts[0].ends_at)-Date.parse(slot),30*60000);
assert.equal(queued.length,1);await queued.shift()();assert.equal(deliveries.length,1);
assert.equal((await route.POST(req({...payload,email:'bad'}),ctx)).status,400);
assert.equal((await route.POST(req({...payload,website:'spam'}),ctx)).status,400);
assert.equal((await route.POST(req(payload,'https://evil.test'),ctx)).status,403);
open=[];assert.equal((await route.POST(req(),ctx)).status,409);open=[slot];
quota=false;assert.equal((await route.POST(req(),ctx)).status,429);quota=true;
insertError={code:'23505'};assert.equal((await route.POST(req(),ctx)).status,409);assert.equal(queued.length,0,'A losing concurrent booking must not send confirmation');insertError=null;
found.card.published=false;assert.equal((await route.POST(req(),ctx)).status,404);found.card.published=true;
found.agent.booking_enabled=false;assert.equal((await route.GET(new Request('https://tapsynk.test/api/appointments/test-card'),ctx)).status,404);found.agent.booking_enabled=true;
found.subscription.tier='virtual';assert.equal((await route.POST(req(),ctx)).status,404);found.subscription.tier='ai';
allowed=false;assert.equal((await route.POST(req(),ctx)).status,429);allowed=true;
const response=await route.GET(new Request('https://tapsynk.test/api/appointments/test-card'),ctx);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const available=await response.json();assert.deepEqual(available.slots,[slot]);assert.equal(available.timezone,'UTC');
console.log('Direct booking tests passed: review URLs, business timezones, unavailable slots, owner scoping, quotas, conflicts, plan gates and post-save delivery.');
