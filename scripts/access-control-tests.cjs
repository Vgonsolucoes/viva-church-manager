const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>{if(id in deps)return deps[id];throw Error(id)},URL,Date,Intl,console,process:{env:{NEXTAUTH_SECRET:"test"}}});return exports;}
const rbac=load('src/server/rbac.ts');const rules=load('src/lib/access-control.ts',{'@/server/rbac':rbac});
const identity=(type='MEMBER',ministries=[],roles=['MEMBER'])=>({type,ministries,roles});
const ministry=(id,name,active=true)=>({id,name,active});
const resolve=(id,config=rules.defaultAccessConfig())=>rules.resolveAccess(id,config);
test('Members, visitors and new members get the requested APK modules and no administrative permissions',()=>{
 for(const type of ['MEMBER','VISITOR','NEW_MEMBER']){const access=resolve(identity(type));assert.equal(access.webEnabled,false);assert.deepEqual(Array.from(access.mobileModules),Array.from(rules.DEFAULT_MOBILE));assert.equal(access.agendaScope,'own');assert.equal(access.mobilePermissions.includes('kids:checkin:self'),true);for(const denied of ['kids:write','members:read','finance:read','settings:manage'])assert.equal(access.mobilePermissions.includes(denied),false);}
});
test('Visitors and new members cannot inherit web privileges from a ministry or stale staff role',()=>{
 for(const type of ['VISITOR','NEW_MEMBER']){const access=resolve(identity(type,[ministry('kids','Ministério Kids')],['KIDS_MINISTRY','SECRETARY']));assert.equal(access.webEnabled,false);assert.equal(access.webPermissions.length,0);}
});
test('Acolher and Kids have exactly the requested web modules, and inactive links grant nothing',()=>{
 const acolher=resolve(identity('VOLUNTEER',[ministry('a','Ministério ACOLHER')],['VOLUNTEER']));assert.deepEqual(Array.from(acolher.webModules).sort(),['calendar','members','followup','volunteers','cells','lostfound'].sort());
 const kids=resolve(identity('VOLUNTEER',[ministry('k','Ministério Kids')],['KIDS_MINISTRY']));assert.deepEqual(Array.from(kids.webModules).sort(),['kids','calendar','lostfound'].sort());assert.equal(kids.webPermissions.includes('members:read'),false);
 const revoked=resolve(identity('VOLUNTEER',[ministry('k','Ministério Kids',false)],['KIDS_MINISTRY']));assert.equal(revoked.webEnabled,false);
});
test('Multiple active ministries combine grants; read-only settings do not grant writes',()=>{
 const config=rules.defaultAccessConfig();config.ministries.k={webEnabled:true,web:{kids:'read'},mobile:[],agendaScope:'own'};
 const access=resolve(identity('VOLUNTEER',[ministry('a','Acolher'),ministry('k','Kids')],['VOLUNTEER']),config);assert.ok(access.webPermissions.includes('members:write'));assert.ok(access.webPermissions.includes('kids:read'));assert.equal(access.webPermissions.includes('kids:write'),false);
});
test('Type settings can revoke APK modules without a MEMBER role silently adding them back',()=>{
 const config=rules.defaultAccessConfig();config.types.MEMBER={webEnabled:false,web:{},mobile:['home','kids'],agendaScope:'own'};const access=resolve(identity(),config);assert.deepEqual(Array.from(access.mobileModules),['home','kids']);assert.equal(access.mobilePermissions.includes('calendar:read'),false);
});
test('Super admin remains unrestricted even when assigned a visitor type and empty configuration',()=>{
 const config=rules.defaultAccessConfig();config.types.VISITOR={webEnabled:false,web:{},mobile:[],agendaScope:'own'};const access=resolve(identity('VISITOR',[],['SUPER_ADMIN']),config);assert.ok(access.webEnabled);assert.equal(access.webModules.length,rules.WEB_MODULES.length);assert.equal(access.mobileModules.length,rules.MOBILE_MODULES.length);assert.ok(access.webPermissions.includes('settings:manage'));assert.equal(access.agendaScope,'all');
});
test('A member with secondary volunteer registration receives the schedule module',()=>{assert.ok(resolve({...identity(),types:['MEMBER','VOLUNTEER']}).mobileModules.includes('schedules'));});
test('Personal agenda filters schedules by the authenticated volunteer and never reads every cell',async()=>{
 const calls=[];const ctx={roles:['VOLUNTEER'],permissions:['calendar:read','events:read'],access:{agendaScope:'own'},member:{id:'member-1'},user:{id:'user-1',member:{id:'member-1'}},volunteerProfile:{id:'volunteer-1'}};
 const agenda=load('src/app/api/v1/agenda/route.ts',{'next/server':{NextResponse:{json:body=>body}},zod:require('zod'),'@/server/db':{prisma:{schedule:{findMany:async args=>{calls.push(['schedule',args]);return []}},event:{findMany:async args=>{calls.push(['event',args]);return []}},cell:{findMany:async args=>{calls.push(['cell',args]);return []}},discipleshipMeeting:{findMany:async()=>[]}}},'@/server/session-helpers':{requireLoggedIn:async()=>({ok:true,ctx})},'@/server/rbac':rbac,'@/server/weekly-services':{ensureWeeklyServices:async()=>{}},'@/lib/weekly-services':{churchAgendaRange:()=>({from:new Date(),to:new Date(Date.now()+86400000)})},'@/lib/public-image-url':{publicImageUrl:v=>v}});
 await agenda.GET(new Request('https://viva.example/api/v1/agenda'));
 const schedules=calls.find(c=>c[0]==='schedule')[1];assert.equal(schedules.where.assignments.some.volunteerId,'volunteer-1');assert.equal(calls.find(c=>c[0]==='event')[1].where.OR[0].sales.some.createdById,'user-1');assert.equal(calls.find(c=>c[0]==='event')[1].where.OR[1].responsibleMemberId,'member-1');assert.equal(calls.filter(c=>c[0]==='cell').length,1);assert.ok(calls.find(c=>c[0]==='cell')[1].where.OR.every(c=>Object.values(c).includes('member-1')));
});
test('Web route enforcement rejects direct URLs and read-only mutations using fresh permissions',async()=>{
 let current=resolve(identity('VOLUNTEER',[ministry('k','Kids')],['VOLUNTEER']));current.roles=['VOLUNTEER'];
 const next={next:()=>({status:200}),json:(body,options)=>({status:options.status,body}),redirect:url=>({status:307,url:String(url)})};
 const {default:proxy}=load('src/proxy.ts',{'next-auth/jwt':{getToken:async()=>({uid:'u1',roles:['SUPER_ADMIN']})},'next/server':{NextResponse:next},'@/server/access-control':{getUserAccess:async()=>current},'@/lib/access-control':rules,'@/server/rbac':rbac});
 const req=(path,method='GET')=>({url:'https://viva.example'+path,nextUrl:new URL('https://viva.example'+path),method});
 assert.equal((await proxy(req('/admin/kids'))).status,200);assert.equal((await proxy(req('/admin/members'))).status,307);assert.equal((await proxy(req('/admin/members','POST'))).status,403);assert.equal((await proxy(req('/api/reports/members.xlsx'))).status,403);
 const config=rules.defaultAccessConfig();config.ministries.k={webEnabled:true,web:{kids:'read'},mobile:[],agendaScope:'own'};current={...resolve(identity('VOLUNTEER',[ministry('k','Kids')],['VOLUNTEER']),config),roles:['VOLUNTEER']};assert.equal((await proxy(req('/admin/kids','POST'))).status,403);
 current={...resolve(identity('VISITOR')),roles:['MEMBER']};assert.equal((await proxy(req('/admin/kids'))).status,307);
});
// Integration: the stored policy is reloaded on each operation, without trusting old token roles.
test('Saving access requires super admin and the persisted policy is used by the next request',async()=>{
 let actor={uid:'super',roles:['SUPER_ADMIN']},stored=null,writes=0;
 const configStore={findUnique:async()=>stored,upsert:async({create,update})=>{stored={key:'user-access-control:v1',value:stored?update.value:create.value};writes++;return stored}};
 const db={appSetting:configStore,user:{findUnique:async()=>({roles:[{role:'MEMBER'}],member:{type:'MEMBER',types:['MEMBER'],ministry:null,memberMinistries:[],ministriesLeading:[],volunteerProfile:null}})},ministry:{findUnique:async()=>null},$transaction:async fn=>fn({appSetting:configStore})};
 const server=load('src/server/access-control.ts',{zod:require('zod'),'@/server/db':{prisma:db},'@/lib/access-control':rules});
 const action=load('src/app/(admin)/admin/settings/access/actions.ts',{'next-auth':{getServerSession:async()=>actor},'next/cache':{revalidatePath:()=>{}},'@/server/auth':{authOptions:{}},'@/server/db':{prisma:db},'@/server/access-control':server,'@/lib/access-control':rules,'@/server/rbac':rbac,'@/server/audit':{logAudit:async()=>{}}});
 const profile={webEnabled:false,web:{},mobile:['home','kids'],agendaScope:'own'};
 assert.equal((await action.saveAccessProfile('types','MEMBER',profile)).ok,true);assert.equal(writes,1);
 const actual=await server.getUserAccess('member-user');assert.deepEqual(Array.from(actual.mobileModules),['home','kids']);assert.equal(actual.webEnabled,false);assert.equal(actual.mobilePermissions.includes('calendar:read'),false);
 actor={uid:'volunteer',roles:['VOLUNTEER']};assert.equal((await action.saveAccessProfile('types','MEMBER',{...profile,webEnabled:true,web:{finance:'write'}})).ok,false);assert.equal(writes,1);
 actor={uid:'super',roles:['SUPER_ADMIN']};assert.equal((await action.saveAccessProfile('roles','SUPER_ADMIN',profile)).ok,false);assert.equal(writes,1);
});
