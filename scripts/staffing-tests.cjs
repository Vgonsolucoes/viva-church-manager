const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>{if(id in deps)return deps[id];throw Error(id)},Date,Intl,URL,console});return exports;}
const calendar=load('src/lib/weekly-services.ts');const utils=load('src/lib/staffing.ts',{'@/lib/weekly-services':calendar});
function setup(){const rows=new Map(),resets=[],assignments=[];let writes=0;
 const db={schedule:{findUnique:async({where})=>rows.get(where.id)??null,findFirst:async({where})=>[...rows.values()].find(row=>Object.entries(where).every(([key,value])=>row[key]===value))??null,upsert:async({where,create,update})=>{writes++;if(!rows.has(where.id))rows.set(where.id,{staffingCompletedAt:null,...create});else Object.assign(rows.get(where.id),update);return rows.get(where.id)}},scheduleAssignment:{updateMany:async args=>{resets.push(args);for(const a of assignments)if(a.scheduleId===args.where.scheduleId&&a.status!=='DECLINED')Object.assign(a,args.data)}},$transaction:async fn=>fn(db),event:{findMany:async()=>[]},course:{findMany:async()=>[]}};
 return {rows,resets,assignments,db,get writes(){return writes},service:load('src/server/staffing.ts',{'@/server/db':{prisma:db},'@/lib/staffing':utils})};}
const now=new Date('2026-11-04T15:00:00Z');

test('Mobile replies update the selected assignment, preserve other volunteers and tolerate retries', async () => {
  const rows = [
    { id: 'a1', scheduleId: 's1', volunteerId: 'v1', status: 'PENDING' },
    { id: 'a2', scheduleId: 's1', volunteerId: 'v2', status: 'PENDING' },
    { id: 'a3', scheduleId: 's1', volunteerId: 'v2', status: 'PENDING' },
  ];
  const audit = [];
  const matching = (where) => rows.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));
  const prisma = {
    scheduleAssignment: {
      findUnique: async ({ where }) => matching(where)[0] ?? null,
      findMany: async ({ where, take }) => matching(where).slice(0, take),
      updateMany: async ({ where, data }) => {
        const found = matching(where);
        found.forEach((row) => Object.assign(row, data));
        return { count: found.length };
      },
    },
    $transaction: async (operation) => operation(prisma),
  };
  const { respondToSchedule } = load('src/server/schedule-response.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/server/db': { prisma },
    '@/server/audit': { logAudit: async (entry) => audit.push(entry) },
    '@/server/rbac': { hasPermission: () => false },
  });
  const v1 = { user: { id: 'u1' }, volunteerProfile: { id: 'v1' }, permissions: [] };
  const v2 = { user: { id: 'u2' }, volunteerProfile: { id: 'v2' }, permissions: [] };
  const confirm = { reason: 'CONFIRMED' };
  const refusal = { reason: 'VIAGEM', note: null };
  assert.equal((await respondToSchedule(v2, 'a1', 'CONFIRMED', confirm)).status, 403);
  assert.equal((await respondToSchedule(v2, 's1', 'DECLINED', refusal)).status, 409);
  assert.equal((await respondToSchedule(v2, 'a2', 'DECLINED', refusal)).body.status, 'DECLINED');
  assert.equal((await respondToSchedule(v2, 'a2', 'DECLINED', refusal)).status, 200);
  assert.equal((await respondToSchedule(v2, 'a2', 'CONFIRMED', confirm)).status, 409);
  assert.equal((await respondToSchedule(v1, 'a1', 'CONFIRMED', confirm)).body.status, 'CONFIRMED');
  assert.equal(rows[2].status, 'PENDING');
  assert.equal(audit.length, 2);
});

const event={id:'event1',name:'Culto de domingo',type:'SERVICE',startsAt:new Date('2026-11-08T21:00:00Z'),endsAt:null};
test('Month boundaries use Brasília time, include the whole month, and exclude the next month',()=>{const {from,to}=utils.staffingMonthRange('2026-11');assert.equal(from.toISOString(),'2026-11-01T03:00:00.000Z');assert.equal(to.toISOString(),'2026-12-01T03:00:00.000Z');assert.equal(utils.staffingMonth(new Date('2026-12-01T02:59:00Z')),'2026-11');assert.equal(utils.staffingMonthRange('2026-12').to.toISOString(),'2027-01-01T03:00:00.000Z');assert.throws(()=>utils.staffingMonthRange('2026-13'));});
test('Every service/event gets one linked pending schedule and repeated reads do not overwrite completion',async()=>{const state=setup();const id=await state.service.syncStaffingSchedule(event,now);assert.equal(state.rows.get(id).eventId,'event1');assert.equal(state.rows.get(id).kind,'SERVICE');state.rows.get(id).staffingCompletedAt=now;await state.service.syncStaffingSchedule(event,now);assert.equal(state.rows.size,1);assert.equal(state.writes,1);assert.equal(state.rows.get(id).staffingCompletedAt,now);await state.service.syncStaffingSchedule({...event,id:'conference',type:'CONFERENCE'},now);assert.equal(state.rows.get('staffing-event-conference').kind,'EVENT');});
test('Open or future courses create pendencies; closed past templates do not',async()=>{const state=setup();const course={id:'course1',title:'Integração',startsAt:new Date('2026-11-06T22:00:00Z'),endsAt:null,agendaVisible:false};const id=await state.service.syncStaffingSchedule(course,now);assert.equal(state.rows.get(id).courseId,'course1');assert.equal(state.rows.get(id).eventId,undefined);assert.equal(await state.service.syncStaffingSchedule({...course,id:'old-template',startsAt:new Date('2026-10-01T12:00:00Z')},now),null);assert.ok(await state.service.syncStaffingSchedule({...course,id:'open-course',startsAt:new Date('2026-11-01T12:00:00Z'),agendaVisible:true},now));});
test('Rescheduling keeps the assigned volunteers, reopens planning and requests confirmation again',async()=>{const state=setup();const id=await state.service.syncStaffingSchedule(event,now);state.rows.get(id).staffingCompletedAt=now;state.assignments.push({scheduleId:id,volunteerId:'v1',status:'CONFIRMED',confirmedAt:now});await state.service.syncStaffingSchedule({...event,startsAt:new Date('2026-11-15T21:00:00Z')},now);assert.equal(state.rows.get(id).staffingCompletedAt,null);assert.equal(state.assignments[0].volunteerId,'v1');assert.equal(state.assignments[0].status,'PENDING');assert.equal(state.assignments[0].confirmedAt,null);assert.equal(state.rows.size,1);});
test('Schedules already explicitly linked to an event are reused without creating a duplicate',async()=>{const state=setup();state.rows.set('manual',{id:'manual',eventId:'event1',title:'Equipe existente',startsAt:event.startsAt});assert.equal(await state.service.syncStaffingSchedule(event,now),'manual');assert.equal(state.rows.size,1);assert.equal(state.writes,0);});
test('Pending, draft, complete and refused/substitution states remain distinct without fabricated minimums',()=>{const status=(assignments,staffingCompletedAt=null)=>utils.staffingState({assignments,staffingCompletedAt}).key;assert.equal(status([]),'pending');assert.equal(status([{status:'PENDING'}]),'draft');assert.equal(status([{status:'PENDING'}],now),'complete');assert.equal(status([{status:'DECLINED'}],now),'review');assert.equal(status([{status:'CONFIRMED',substitutionRequests:[{status:'REQUESTED'}]}],now),'review');});
test('Assignments enforce write access, ministry membership, and retain the serving ministry',async()=>{let allowed=true,linked=true;const added=[];let complete=now;const db={schedule:{findUnique:async()=>({id:'s1'}),update:async({data})=>{complete=data.staffingCompletedAt}},volunteerProfile:{findUnique:async()=>({id:'v1',ministryId:null,member:{ministryId:null,memberMinistries:linked?[{ministryId:'kids'}]:[]}})},ministry:{findFirst:async()=>({id:'kids'})},scheduleAssignment:{create:async({data})=>{added.push(data);return {id:'a1',...data}}},$transaction:async fn=>fn(db)};
 const actions=load('src/app/(admin)/admin/schedules/actions.ts',{'@/server/access-control':{assertWebPermission:async()=>{if(!allowed)throw Error('DENIED');return {uid:'admin'}}},'next/navigation':{redirect:()=>{}},'@/lib/staffing':utils,'next/cache':{revalidatePath:()=>{}},'next-auth':{getServerSession:async()=>({uid:'admin'})},zod:require('zod'),'@/server/auth':{authOptions:{}},'@/server/audit':{logAudit:async()=>{}},'@/server/db':{prisma:db},'@/server/notifications':{}});
 const form=new FormData();for(const [key,value] of Object.entries({scheduleId:'s1',volunteerId:'v1',ministryId:'kids',roleName:'Sala Kids'}))form.set(key,value);
 assert.equal((await actions.addAssignment({},form)).ok,true);assert.equal(added[0].ministryId,'kids');assert.equal(complete,null);linked=false;assert.equal((await actions.addAssignment({},form)).ok,false);assert.equal(added.length,1);allowed=false;await assert.rejects(actions.addAssignment({},form),/DENIED/);
});
test('A new assignment saves a private inbox notice and sends push only after commit', async () => {
  const recorded = [];
  const pushes = [];
  let committed = false;
  const db = {
    schedule: {
      findUnique: async () => ({ id: 's1' }),
      update: async () => ({ title: 'Culto', startsAt: event.startsAt }),
    },
    volunteerProfile: {
      findUnique: async () => ({
        ministryId: 'kids',
        member: { ministryId: 'kids', memberMinistries: [], user: { id: 'user-1' } },
      }),
    },
    ministry: { findFirst: async () => ({ id: 'kids', name: 'Kids' }) },
    scheduleAssignment: {
      create: async () => {
        if (committed) throw Object.assign(new Error('duplicate'), { code: 'P2002' });
        return { id: 'a1' };
      },
    },
    notification: { create: async ({ data }) => recorded.push(data) },
    $transaction: async (callback) => {
      const result = await callback(db);
      committed = true;
      return result;
    },
  };
  const notifications = load('src/server/notifications.ts', { 'expo-server-sdk': {}, '@/server/db': { prisma: db } });
  const actions = load('src/app/(admin)/admin/schedules/actions.ts', {
    '@/server/access-control': { assertWebPermission: async () => ({ uid: 'admin' }) },
    'next/navigation': {}, '@/lib/staffing': utils, 'next/cache': { revalidatePath: () => {} },
    'next-auth': {}, zod: require('zod'), '@/server/auth': {}, '@/server/audit': { logAudit: async () => {} },
    '@/server/db': { prisma: db },
    '@/server/notifications': {
      recordScheduleAssignmentNotification: notifications.recordScheduleAssignmentNotification,
      sendExpoPushToUsers: async (userIds, payload) => {
        assert.ok(committed);
        pushes.push({ userId: userIds[0], count: userIds.length, payload });
      },
    },
  });
  const form = new FormData();
  for (const [name, value] of Object.entries({ scheduleId: 's1', volunteerId: 'v1', ministryId: 'kids', roleName: 'Sala Kids' })) form.set(name, value);
  assert.equal((await actions.addAssignment({}, form)).ok, true);
  assert.equal(recorded[0].deliveries.create.userId, 'user-1');
  assert.match(recorded[0].body, /08\/11\/2026.*18:00/);
  assert.equal(pushes[0].userId, 'user-1');
  assert.equal(pushes[0].count, 1);
  assert.equal(pushes[0].payload.body, recorded[0].body);
  assert.equal((await actions.addAssignment({}, form)).ok, false);
  assert.equal(recorded.length, 1);
  assert.equal(pushes.length, 1);
});
test('Creating an event opens its scheduling pendency with Brasília time and unchecked options',async()=>{
 let created,linked;const deps={'@/server/staffing':{syncStaffingSchedule:async source=>{linked=source;return 'staffing-event-event-new'}},'@/lib/staffing':utils,'@/server/rbac':{hasPermission:(_p,key)=>key==='schedules:read'},'@/server/access-control':{assertWebPermission:async()=>({uid:'admin'})},'next/navigation':{redirect:url=>{throw Error(url)}},'next/cache':{revalidatePath:()=>{}},'next-auth':{getServerSession:async()=>({uid:'admin',permissions:['events:write','schedules:read']})},zod:require('zod'),'@/server/auth':{authOptions:{}},'@/server/db':{prisma:{event:{create:async({data})=>{created={id:'event-new',...data};return created}}}},'@/server/audit':{logAudit:async()=>{}},'@/server/uploads':{savePublicImageUpload:async()=>null}};
 const source=fs.readFileSync('src/app/(admin)/admin/events/page.tsx','utf8').split('async function createSale')[0]+'\nexport {createEvent};';const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:id=>deps[id]??{},Date,Intl,URL,console});
 const form=new FormData();for(const [key,value] of Object.entries({name:'Culto especial',type:'SERVICE',startsAt:'2026-11-08T18:00',endsAt:'',location:'Sede',bannerImageUrl:'',capacity:'',ticketPrice:''}))form.set(key,value);
 await assert.rejects(exports.createEvent(form),/\/admin\/schedules\?month=2026-11.*focus=staffing-event-event-new/);assert.equal(created.startsAt.toISOString(),'2026-11-08T21:00:00.000Z');assert.equal(linked.id,created.id);assert.equal(created.isPaid,false);
});
test('A new dated course opens its linked scheduling pendency',async()=>{
 let created,linked;const deps={'@/server/staffing':{syncStaffingSchedule:async source=>{linked=source;return 'staffing-course-course-new'}},'@/lib/staffing':utils,'@/server/rbac':{hasPermission:()=>true},'@/server/access-control':{assertWebPermission:async()=>({uid:'admin'})},'next/navigation':{redirect:url=>{throw Error(url)}},'next/cache':{revalidatePath:()=>{}},'next-auth':{getServerSession:async()=>({uid:'admin',permissions:['courses:write','schedules:read']})},zod:require('zod'),'@/server/auth':{authOptions:{}},'@/server/db':{prisma:{course:{findUnique:async()=>null,create:async({data})=>{created={id:'course-new',...data};return created}}}},'@/server/audit':{logAudit:async()=>{}},'@/server/uploads':{savePublicImageUpload:async()=>null},'@/server/notifications':{createNotificationCampaign:async()=>{}}};
 const source=fs.readFileSync('src/app/(admin)/admin/courses/page.tsx','utf8').split('function inputDate')[0]+'\nexport {saveCourse};';const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:id=>deps[id]??{},Date,Intl,URL,console});
 const form=new FormData();for(const [key,value] of Object.entries({courseId:'',title:'Curso Integração',description:'',details:'',instructorName:'',startsAt:'2026-11-09T19:00',endsAt:'',location:'Sede',bannerImageUrl:'',audience:'BOTH',trackOrder:''}))form.set(key,value);
 await assert.rejects(exports.saveCourse(form),/\/admin\/schedules\?month=2026-11.*focus=staffing-course-course-new/);assert.equal(linked.id,created.id);assert.equal(created.startsAt.toISOString(),'2026-11-09T22:00:00.000Z');
});
test('Mobile assignments keep their serving ministry and provide the location required by the current APK',async()=>{
 const item={id:'a1',scheduleId:'s1',volunteerId:'v1',roleName:'Recepção',status:'PENDING',confirmedAt:null,ministryId:'acolher',ministry:{id:'acolher'},schedule:{id:'s1',title:'Culto',startsAt:now,endsAt:null,ministryId:null,ministry:null,event:{location:'Sede'},course:null},substitutionRequests:[]};
 const route=load('src/app/api/v1/schedules/my/route.ts',{'next/server':{NextResponse:{json:value=>value}},'@/server/db':{prisma:{scheduleAssignment:{findMany:async()=>[item]}}},'@/server/session-helpers':{requireLoggedIn:async()=>({ok:true,ctx:{volunteerProfile:{id:'v1'},permissions:['schedules:read']}})},'@/server/rbac':{hasPermission:()=>true}});
 const result=await route.GET({url:'https://church.test/api/v1/schedules/my'});
 const mobile=load('apps/mobile/src/types/index.ts',{zod:require('zod')});
 const parsed=mobile.ScheduleAssignmentSchema.parse(result[0]);assert.equal(parsed.schedule.ministryId,'acolher');assert.equal(parsed.schedule.location,'Sede');
 item.schedule.event=null;assert.equal((await route.GET({url:'https://church.test/api/v1/schedules/my'}))[0].schedule.location,null);
});
