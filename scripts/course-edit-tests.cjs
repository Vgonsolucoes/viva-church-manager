const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function setup(allowed=true){
 const original={id:'course1',slug:'original',title:'Antes',startsAt:new Date('2026-11-01T12:00:00Z'),bannerImageUrl:'/uploads/banner_original.png'};
 const calls={updates:[],creates:[],notifications:[],audit:[]};
 const db={course:{findUnique:async()=>original,update:async args=>{calls.updates.push(args);return {...original,...args.data}},create:async args=>{calls.creates.push(args);return args.data}}};
 const deps={'@/server/staffing':{syncStaffingSchedule:async()=>null},'@/lib/staffing':{staffingUrl:()=>'/admin/schedules'},'@/server/access-control':{assertWebPermission:async()=>{if(!allowed)throw new Error('PERMISSION_DENIED')}},'@/server/db':{prisma:db},'@/server/auth':{authOptions:{}},'next-auth':{getServerSession:async()=>({uid:'admin',roles:[]})},'@/server/rbac':{hasPermission:()=>allowed},'next/navigation':{redirect:url=>{throw new Error(url)}},'next/cache':{revalidatePath:()=>{}},'@/server/uploads':{savePublicImageUpload:async()=>null},'@/server/audit':{logAudit:async data=>calls.audit.push(data)},'@/server/notifications':{createNotificationCampaign:async data=>calls.notifications.push(data)},zod:require('zod')};
 const source=fs.readFileSync('src/app/(admin)/admin/courses/page.tsx','utf8').split('function inputDate')[0]+'\nexport {saveCourse};';
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>deps[id]??{},Date,Intl,URL,console});
 const form=new FormData();for(const [k,v] of Object.entries({courseId:'course1',title:'Curso atualizado',description:'Descrição',details:'Detalhes',instructorName:'Instrutor',startsAt:'2026-11-01T09:00',endsAt:'',location:'Sala',bannerImageUrl:original.bannerImageUrl,audience:'BOTH',trackOrder:''}))form.set(k,v);
 return {save:exports.saveCourse,form,calls};
}
test('Editing keeps course identity and artwork, saves Brasília time, and does not resend launch notifications',async()=>{
 const {save,form,calls}=setup();form.set('notifyMembers','on');await assert.rejects(save(form),/saved=1/);
 assert.equal(calls.updates.length,1);assert.equal(calls.creates.length,0);const {where,data}=calls.updates[0];assert.equal(where.id,'course1');assert.equal(data.slug,'original');assert.equal(data.bannerImageUrl,'/uploads/banner_original.png');assert.equal(data.startsAt.toISOString(),'2026-11-01T12:00:00.000Z');assert.equal(data.agendaVisible,false);assert.equal(calls.notifications.length,0);assert.equal(calls.audit[0].action,'UPDATE');
});
test('Read-only users cannot update a course',async()=>{const {save,form,calls}=setup(false);await save(form);assert.equal(calls.updates.length,0)});
test('Invalid end dates do not update the course',async()=>{const {save,form,calls}=setup();form.set('endsAt','2026-10-01T09:00');await assert.rejects(save(form),/error=invalid/);assert.equal(calls.updates.length,0)});
