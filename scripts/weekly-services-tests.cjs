const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file, deps={}) {
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
 {exports,require:id=>{if(id in deps)return deps[id];throw Error(id);},Date,Intl,URL,Request,console});return exports;
}
const recurrence=load('src/lib/weekly-services.ts');
const imageUrls=load('src/lib/public-image-url.ts');
test('Artwork uses the public reverse proxy host and preserves external image URLs',()=>{
 const request=new Request('https://localhost:80/api/v1/events',{headers:{'x-forwarded-host':'viva.example','x-forwarded-proto':'https'}});
 assert.equal(imageUrls.publicImageUrl('/uploads/banner_test.png',request),'https://viva.example/uploads/banner_test.png');
 assert.equal(imageUrls.publicImageUrl('https://cdn.example/art.jpg',request),'https://cdn.example/art.jpg');
 assert.equal(imageUrls.publicImageUrl(null,request),null);
 const hostOnly=new Request('http://localhost:80/api/v1/events',{headers:{host:'viva.example','x-forwarded-proto':'https'}});
 assert.equal(imageUrls.publicImageUrl('/uploads/art.png',hostOnly),'https://viva.example/uploads/art.png');
});
const configs=recurrence.WEEKLY_SERVICES.filter(service=>service.key===service.configKey).map(service=>({key:service.configKey,name:service.name,location:null,bannerImageUrl:null}));
test('One Sunday configuration shares its existing artwork with both hours and reconciles future morning services',async()=>{
 const shared={name:'Culto de domingo',location:'Sede',bannerImageUrl:'/uploads/banner_sunday.png'};
 const rows=[{key:'weekly-service:sunday',value:JSON.stringify(shared)},{key:'weekly-service:sundayMorning',value:JSON.stringify({name:'Culto de domingo · manhã',location:null,bannerImageUrl:'/uploads/old_morning.png'})}];
 const events=[
  {id:'viva-weekly-sundayMorning-2026-11-01',startsAt:new Date('2026-11-01T12:00:00Z'),name:'Culto de domingo · manhã',location:null,bannerImageUrl:'/uploads/old_morning.png'},
  {id:'viva-weekly-sunday-2026-11-01',startsAt:new Date('2026-11-01T21:00:00Z'),...shared},
  {id:'viva-weekly-sundayMorning-2026-10-25',startsAt:new Date('2026-10-25T12:00:00Z'),name:'Histórico',location:null,bannerImageUrl:'/uploads/history.png'},
 ];
 const db={appSetting:{findMany:async()=>rows},event:{findMany:async()=>events,createMany:async({data})=>events.push(...data),updateMany:async({where,data})=>{for(const event of events)if(where.id.in.includes(event.id))Object.assign(event,data);}}};
 const service=load('src/server/weekly-services.ts',{'zod':require('zod'),'@/server/db':{prisma:db},'@/lib/weekly-services':recurrence});
 const groups=await service.getWeeklyServices();assert.deepEqual(Array.from(groups,item=>item.key),['sunday','wednesday']);
 await service.ensureWeeklyServices(new Date('2026-10-30T18:00:00Z'));
 for(const id of ['viva-weekly-sundayMorning-2026-11-01','viva-weekly-sunday-2026-11-01']){
  const event=events.find(event=>event.id===id);assert.equal(event.name,shared.name);assert.equal(event.bannerImageUrl,shared.bannerImageUrl);
 }
 assert.equal(events.find(event=>event.id==='viva-weekly-sundayMorning-2026-10-25').bannerImageUrl,'/uploads/history.png');
 const nextSunday=events.filter(event=>event.startsAt.toISOString().startsWith('2026-11-08'));
 assert.equal(nextSunday.length,2);assert.ok(nextSunday.every(event=>event.bannerImageUrl===shared.bannerImageUrl));
});
test('Mobile feeds separate services from events and preserve their artwork and chronological order',()=>{
 const {splitUpcomingEvents}=load('apps/mobile/src/utils/event-feed.ts');
 const entries=Object.freeze([
  {id:'evening',type:'SERVICE',startsAt:'2026-11-01T21:00:00Z',bannerImageUrl:'https://church.example/evening.png'},
  {id:'conference',type:'CONFERENCE',startsAt:'2026-11-02T20:00:00Z',bannerImageUrl:'https://church.example/event.png'},
  {id:'morning',type:'SERVICE',startsAt:'2026-11-01T12:00:00Z',bannerImageUrl:'https://church.example/morning.png'},
  {id:'old',type:'SERVICE',startsAt:'2026-10-25T12:00:00Z',bannerImageUrl:null},
 ]);
 const feed=splitUpcomingEvents(entries,Date.parse('2026-11-01T10:00:00Z'));
 assert.deepEqual(Array.from(feed.services,item=>item.id),['morning','evening']);
 assert.deepEqual(Array.from(feed.events,item=>item.id),['conference']);
 assert.equal(feed.services[0].bannerImageUrl,'https://church.example/morning.png');
 assert.equal(entries[0].id,'evening');
});
test('Both Sunday services at 09h and 18h and Wednesday at 20h repeat across years',()=>{
 const events=recurrence.weeklyOccurrences(new Date('2026-12-27T00:00:00Z'),new Date('2027-01-08T00:00:00Z'),configs);
 assert.deepEqual(Array.from(events,e=>e.startsAt.toISOString()),['2026-12-27T12:00:00.000Z','2026-12-27T21:00:00.000Z','2026-12-30T23:00:00.000Z','2027-01-03T12:00:00.000Z','2027-01-03T21:00:00.000Z','2027-01-06T23:00:00.000Z']);
 assert.equal(new Set(events.map(e=>e.id)).size,events.length);
 const future=recurrence.weeklyOccurrences(new Date('2035-01-01T00:00:00Z'),new Date('2035-02-01T00:00:00Z'),configs);assert.ok(future.length>=8);
});
test('Ranges respect church local midnight, not UTC midnight; end is exclusive',()=>{
 const range=recurrence.churchAgendaRange('today',new Date('2026-11-02T01:00:00Z'));
 assert.equal(range.from.toISOString(),'2026-11-01T03:00:00.000Z');assert.equal(range.to.toISOString(),'2026-11-02T03:00:00.000Z');
 assert.equal(recurrence.weeklyOccurrences(new Date('2026-11-01T21:00:00Z'),new Date('2026-11-04T23:00:00Z'),configs).length,1);
});
test('Materialization is idempotent across processes and respects a previously registered service',async()=>{
 const events=[{id:'manual',startsAt:new Date('2026-11-01T21:00:00Z')}];
 const db={appSetting:{findMany:async()=>[]},event:{findMany:async()=>events,createMany:async({data})=>{for(const e of data)if(!events.some(old=>old.id===e.id))events.push(e);}}};
 const fresh=()=>load('src/server/weekly-services.ts',{'zod':require('zod'),'@/server/db':{prisma:db},'@/lib/weekly-services':recurrence});
 await fresh().ensureWeeklyServices(new Date('2026-10-30T18:00:00Z'));const count=events.length;
 await fresh().ensureWeeklyServices(new Date('2026-10-30T18:00:00Z'));assert.equal(events.length,count);
 assert.equal(events.filter(e=>e.startsAt.toISOString()==='2026-11-01T21:00:00.000Z').length,1);
 assert.equal(events.filter(e=>e.startsAt.toISOString()==='2026-11-01T12:00:00.000Z').length,1);
 assert.ok(events.some(e=>e.id==='viva-weekly-sundayMorning-2026-11-01'));
});
test('Agenda defaults and event payload parse with the real mobile schema, including artwork',async()=>{
 const {AgendaItemSchema}=load('apps/mobile/src/types/index.ts',{'zod':require('zod')});
 let ensured=0;
 const api=load('src/app/api/v1/agenda/route.ts',{
  'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200})}},'zod':require('zod'),
  '@/server/db':{prisma:{event:{findMany:async()=>[{id:'viva-weekly-sunday-2026-11-01',name:'Culto de domingo',type:'SERVICE',startsAt:new Date('2026-11-01T21:00:00Z'),endsAt:null,location:null,responsible:null,bannerImageUrl:'/uploads/banner_test.png'}]}}},
  '@/server/session-helpers':{requireLoggedIn:async()=>({ok:true,ctx:{roles:[],user:{member:null}}})},
  '@/server/rbac':{hasPermission:()=>false},'@/server/weekly-services':{ensureWeeklyServices:async()=>{ensured++;}},'@/lib/weekly-services':recurrence,
  '@/lib/public-image-url':imageUrls,
 });
 const response=await api.GET(new Request('https://church.example/api/v1/agenda'));
 assert.equal(response.status,200);assert.equal(ensured,1);const item=AgendaItemSchema.parse(response.body[0]);
 assert.equal(item.category,'CULTO');assert.equal(item.entityId,'viva-weekly-sunday-2026-11-01');assert.equal(item.bannerImageUrl,'https://church.example/uploads/banner_test.png');
});
