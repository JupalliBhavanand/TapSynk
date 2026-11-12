import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
const steps=[];let fail=false;
const mocks={
 'server-only':{},
 '@/lib/google-calendar':{syncAppointmentToGoogle:async(id,owner)=>{assert.equal(id,'booking');assert.equal(owner,'owner');steps.push('sync-start');await Promise.resolve();steps.push('sync-ready');if(fail)throw Error('unavailable');return {ok:true,meetUrl:'https://meet.google.com/abc-defg-hij'}}},
 '@/lib/appointment-mail':{sendAppointmentConfirmation:async booking=>{assert.equal(steps.at(-1),'sync-ready');assert.equal(booking.meetUrl,fail?undefined:'https://meet.google.com/abc-defg-hij');steps.push('guest');return {sent:true}}},
 '@/lib/notification-mail':{sendOwnerNotificationForEntity:async(kind,id)=>{assert.ok(steps.includes('sync-ready'));assert.equal(kind,'appointment');assert.equal(id,'booking');steps.push('owner');return {sent:true}}},
};
const loadedModule={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/booking-delivery.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module: loadedModule,exports:loadedModule.exports,require:name=>mocks[name]});
await loadedModule.exports.deliverBookedMeeting({id:'booking'},'owner');
assert.equal(steps.join(','),'sync-start,sync-ready,guest,owner');
steps.length=0;fail=true;const result=await loadedModule.exports.deliverBookedMeeting({id:'booking'},'owner');assert.equal(result.calendar.ok,false);assert.equal(result.deliveries.length,2);
console.log('Meeting delivery: conference creation precedes both messages; calendar outages still deliver booking notifications.');

function load(path,imports){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:name=>imports[name]||{},URL,Intl,Date,process:{env:{}}});return mod.exports;}
const google=load('src/lib/google-calendar.ts',{});
const guest=load('src/lib/appointment-mail.ts',{});
const owner=load('src/lib/notification-mail.ts',{'@/lib/google-calendar':google,'@/lib/notification-types':{notificationHref:value=>value},'@/lib/env':{SITE_URL:'https://example.com'}});
const link='https://meet.google.com/abc-defg-hij';
const guestMessage=guest.confirmationMessage({name:'Guest',business:'Business',host:'Host',starts_at:'2026-12-01T10:00:00Z',ends_at:'2026-12-01T10:30:00Z',timezone:'UTC',meetUrl:link});
assert.ok(guestMessage.html.includes(`href="${link}"`));assert.ok(guestMessage.text.includes('Duration: 30 minutes'));
const ownerMessage=owner.ownerNotificationMessage({title:'Meeting booked',body:'A booking',href:'/dashboard/appointments'},['Join Google Meet: '+link]);
assert.ok(ownerMessage.html.includes(`href="${link}"`));
const event=google.eventBody({id:'booking',name:'Guest',email:'guest@example.com',starts_at:'2026-12-01T10:00:00Z',ends_at:'2026-12-01T10:30:00Z'},{full_name:'Host',company:'Business',slug:'host'});
assert.equal(event.start.dateTime,'2026-12-01T10:00:00Z');assert.equal(event.end.dateTime,'2026-12-01T10:30:00Z');assert.equal(event.conferenceData.createRequest.conferenceSolutionKey.type,'hangoutsMeet');
assert.ok(event.reminders.overrides.some(reminder=>reminder.minutes===0));
console.log('Both emails contain clickable Google Meet links; event times and start-time reminder are preserved.');
