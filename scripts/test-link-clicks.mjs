import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const require = createRequire(import.meta.url);
function load(file, mocks = {}, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(output, { module: loaded, exports: loaded.exports, require: name => name in mocks ? mocks[name] : require(name), URL, Headers, Request, Response, TextEncoder, console, Date, ...globals });
  return loaded.exports;
}
const utils = load('src/lib/utils.ts');
const socials = load('src/lib/socials.ts');
const links = load('src/lib/profile-links.ts', { '@/lib/socials': socials, '@/lib/utils': utils });
const card = { id:'10000000-0000-4000-8000-000000000001', user_id:'20000000-0000-4000-8000-000000000001', company_id:null, slug:'test-profile', full_name:'Test Owner', website:'example.com', phone:'+1 (555) 123-4567', email:'test@example.com', address:'San Jose, CA', socials:{instagram:'@test',linkedin:'https://custom.example/path'}, published:true };
const inventory = links.profileLinks(card);
assert.equal(inventory.length,6);
assert.equal(inventory.find(l=>l.id==='social:linkedin').href,'https://custom.example/path');
assert.equal(links.profileLinks({...card,website:'',phone:'',email:'',address:'',socials:{}}).length,0);
assert.equal(links.linkClickSource('t'),'nfc');assert.equal(links.linkClickSource('qr'),'qr');assert.equal(links.linkClickSource(undefined),'unknown');
assert.equal(links.linkSince('all'),null);
assert.equal(links.linkSince('7',new Date('2026-11-19T10:00:00Z')),'2026-11-12T10:00:00.000Z');
assert.equal(links.linkPeriod('invalid'),'30');
let rows=links.linkClickRows([card],[{card_id:card.id,link_id:'website',link_url:'https://example.com/',clicks:3},{card_id:card.id,link_id:'social:instagram',link_url:'https://www.instagram.com/test',clicks:1},{card_id:card.id,link_id:'website',link_url:'https://old.example/',clicks:99}]);
assert.equal(rows[0].clicks,3);assert.equal(rows[0].share,75);assert.equal(rows.length,6);assert.equal(rows.filter(r=>r.clicks===0).length,4);

// Real rendered markup must use the same identifiers/destinations as reporting.
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const {ProfileCard}=load('src/components/ProfileCard.tsx',{'@/lib/socials':socials,'@/lib/utils':utils,'@/components/BrandIcons':{SOCIAL_ICONS:Object.fromEntries(socials.SOCIAL_PLATFORMS.map(p=>[p.key,()=>null]))}});
const html=renderToStaticMarkup(React.createElement(ProfileCard,{card:{...card,accent:'#1d5bff'}}));
for(const l of inventory)assert.ok(html.includes(`data-profile-link="${l.id}"`),l.id);
assert.ok(!html.includes('Per-Link Clicks'));

const {PerLinkAnalytics}=load('src/components/PerLinkAnalytics.tsx',{'server-only':{},'@/lib/profile-links':links});
const analyticsQueries=[];
const analyticsDb={rpc:async(name,args)=>{analyticsQueries.push({name,args});return {data:[{card_id:card.id,link_id:'website',link_url:'https://example.com/',clicks:3}],error:null};}};
const report=renderToStaticMarkup(await PerLinkAnalytics({supabase:analyticsDb,cards:[card],period:'all'}));
assert.ok(report.includes('Per-Link Clicks'));assert.ok(report.includes('Top link:'));assert.ok(report.includes('Instagram'));assert.ok(report.includes('100.0%'));
assert.equal(analyticsQueries[0].name,'link_click_totals');assert.equal(analyticsQueries[0].args.p_since,null);assert.deepEqual(Array.from(analyticsQueries[0].args.p_card_ids),[card.id]);
assert.ok(report.includes('value="all" selected=""'));
const emptyReport=renderToStaticMarkup(await PerLinkAnalytics({supabase:{rpc:async()=>{throw Error('No unscoped queries');}},cards:[],period:'7'}));
assert.ok(emptyReport.includes('Add a website'));

// Navigation is untouched, analytics never awaits a response, and fast duplicate taps collapse.
let now=10000, beacons=[],fetches=[],uuid=0;
class Element { closest(){return {dataset:{profileLink:'website'},getAttribute:()=> 'https://example.com/'};} }
const browser={navigator:{sendBeacon:(...a)=>{beacons.push(a);return true;}},Blob,Element,crypto:{randomUUID:()=>`id-${++uuid}`},document:{referrer:'https://ref.example/path'},sessionStorage:{getItem:()=>null,setItem(){}},fetch:(...a)=>{fetches.push(a);return Promise.resolve();},Date:{now:()=>now}};
const tracker=load('src/components/ProfileLinkTracker.tsx',{react:{useRef:v=>({current:v})}},browser);
let view=tracker.ProfileLinkTracker({slug:card.slug,source:'nfc',children:null});
const event={isTrusted:true,button:0,target:new Element(),currentTarget:{contains:()=>true},preventDefault:()=>{throw Error('Must never block navigation');}};
assert.equal(view.props.onClickCapture(event),undefined);assert.equal(beacons.length,1);
view.props.onClickCapture(event);assert.equal(beacons.length,1);
now+=2100;view.props.onAuxClickCapture({...event,button:1});assert.equal(beacons.length,2);
now+=2100;view.props.onClickCapture({...event,isTrusted:false});view.props.onClickCapture({...event,button:2});assert.equal(beacons.length,2);
browser.navigator.sendBeacon=()=>false;view.props.onClickCapture(event);assert.equal(fetches.length,1);assert.equal(fetches[0][1].keepalive,true);

// Route validation, bot suppression, canonical URLs, and failure behavior.
let available={card,subscription:{status:'active'}},calls=[],allowed=true,rpcError=null;
const route=load('src/app/api/clicks/[slug]/route.ts',{
 'next/server':{NextResponse:Response},'@/lib/data':{getPublicCard:async()=>available},'@/lib/env':{env:{supabaseServiceKey:()=> 'test-hmac-key'},REQUIRE_SUBSCRIPTION:true},'@/lib/profile-links':links,'@/lib/rate-limit':{rateLimit:async()=>allowed},'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {error:rpcError};}})},'@/lib/types':{isActive:s=>s?.status==='active'},'@/lib/utils':utils,
});
const payload={event_id:'30000000-0000-4000-8000-000000000001',visitor_id:'40000000-0000-4000-8000-000000000001',link_id:'website',link_url:'https://example.com/',source:'nfc',referrer:'https://ref.example/private?secret=value',url:'https://attacker.example/'};
const request=(body=payload,headers={})=>new Request('https://tapsynk.test/api/clicks/test-profile',{method:'POST',headers:{origin:'https://tapsynk.test','content-type':'application/json','user-agent':'Mobile Safari','x-forwarded-for':'192.0.2.1',...headers},body:JSON.stringify(body)});
const context={params:Promise.resolve({slug:card.slug})};
assert.equal((await route.POST(request(),context)).status,204);assert.equal(calls.length,1);
assert.equal(calls[0].args.p_link_url,'https://example.com/');assert.equal(calls[0].args.p_referrer,'https://ref.example');assert.match(calls[0].args.p_visitor_hash,/^[a-f0-9]{64}$/);
for(const headers of [{'sec-purpose':'prefetch'},{'user-agent':'Googlebot'},{'user-agent':'HeadlessChrome'}])assert.equal((await route.POST(request(payload,headers),context)).status,204);
assert.equal(calls.length,1);
assert.equal((await route.POST(request(payload,{origin:'https://evil.test'}),context)).status,403);
assert.equal((await route.POST(request({...payload,link_id:'invented'}),context)).status,400);
assert.equal((await route.POST(request({...payload,link_url:'https://old-or-forged.example/'}),context)).status,400);
assert.equal((await route.POST(request({...payload,event_id:'bad'}),context)).status,400);
available={...available,card:{...card,published:false}};assert.equal((await route.POST(request(),context)).status,404);
available={card,subscription:{status:'canceled'}};assert.equal((await route.POST(request(),context)).status,404);
available={card,subscription:{status:'active'}};allowed=false;assert.equal((await route.POST(request(),context)).status,429);allowed=true;
rpcError={code:'test-unavailable'};assert.equal((await route.POST(request(),context)).status,503);rpcError=null;

// Real PostgreSQL: RLS, service-only writes, replay suppression and date aggregation.
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to public;
create table public.companies(id uuid primary key,owner_id uuid);create table public.cards(id uuid primary key,user_id uuid,company_id uuid, published boolean);
alter table public.cards enable row level security;alter table public.companies enable row level security;
create policy cards_read on public.cards for select using(published or user_id=auth.uid());create policy companies_read on public.companies for select using(owner_id=auth.uid());
grant select on public.cards,public.companies to authenticated,service_role;`);
await db.exec(fs.readFileSync('supabase/migrations/0010_link_clicks.sql','utf8'));
const other='20000000-0000-4000-8000-000000000002',team='50000000-0000-4000-8000-000000000001',teamCard='10000000-0000-4000-8000-000000000002';
await db.query('insert into companies values ($1,$2)',[team,card.user_id]);
await db.query('insert into cards values ($1,$2,null,true),($3,$4,$5,true)',[card.id,card.user_id,teamCard,other,team]);
async function as(role,user,sql,args=[]){return db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user??'']);return tx.query(sql,args);});}
const record='select public.record_link_click($1,$2,$3,$4,$5,$6,$7,$8,$9) as recorded';
const input=[payload.event_id,card.id,'website','Website','https://example.com/','nfc','a'.repeat(64),'Mobile Safari','https://ref.example'];
assert.equal((await as('service_role',null,record,input)).rows[0].recorded,true);
const duplicate=[...input];duplicate[0]='30000000-0000-4000-8000-000000000002';
assert.equal((await as('service_role',null,record,duplicate)).rows[0].recorded,false);
await db.exec("update link_clicks set clicked_at=clock_timestamp()-interval '40 days'");
assert.equal((await as('service_role',null,record,input)).rows[0].recorded,false,'An event UUID replay never creates a second row, even after the short window');
const teamInput=[...input];teamInput[0]='30000000-0000-4000-8000-000000000003';teamInput[1]=teamCard;teamInput[6]='b'.repeat(64);
assert.equal((await as('service_role',null,record,teamInput)).rows[0].recorded,true);
assert.equal((await as('authenticated',card.user_id,'select * from link_clicks')).rows.length,2,'Company owner sees their own and managed team clicks');
assert.equal((await as('authenticated',other,'select * from link_clicks')).rows.length,1,'Other owner sees only their own card');
assert.equal((await as('authenticated','20000000-0000-4000-8000-000000000099','select * from link_clicks')).rows.length,0,'Published cards never expose private analytics');
const aggregate='select public.link_click_totals($1::uuid[],$2::timestamptz) as totals';
assert.equal((await as('authenticated',other,aggregate,[[card.id,teamCard],null])).rows[0].totals.length,1,'Passing another owner’s ID cannot bypass RLS');
assert.equal((await as('authenticated',card.user_id,aggregate,[[card.id,teamCard],new Date(Date.now()-7*86400e3).toISOString()])).rows[0].totals.length,1);
assert.equal((await as('authenticated',card.user_id,aggregate,[[card.id,teamCard],null])).rows[0].totals.length,2);
await db.query('update companies set owner_id=$1 where id=$2',[other,team]);
assert.equal((await as('authenticated',card.user_id,'select * from link_clicks')).rows.length,1,'Transferring a company revokes the old manager immediately');
await db.query('update cards set published=false where id=$1',[teamCard]);
const unpublished=[...teamInput];unpublished[0]='30000000-0000-4000-8000-000000000004';
assert.equal((await as('service_role',null,record,unpublished)).rows[0].recorded,false);
await assert.rejects(as('anon',null,'select * from link_clicks'));
await assert.rejects(as('anon',null,aggregate,[[card.id],null]));
await assert.rejects(as('authenticated',card.user_id,record,input));
await assert.rejects(as('authenticated',card.user_id,'delete from link_clicks'));
await db.close();
console.log('Link click tests passed: real PostgreSQL authorization/deduplication, API validation, URL inventory, time filters, and non-blocking browser handlers.');
