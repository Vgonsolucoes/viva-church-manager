const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:id=>{if(id in deps)return deps[id];throw Error(id)},TextEncoder,Date,Map,JSON,console});return exports;}
const validation=load('src/lib/visitor-registration.ts',{zod:require('zod')});
const input={fullName:'Pessoa de Teste',cpf:'529.982.247-25',email:' Visitor@Example.com ',phone:'(11) 99999-1234',password:'senha-de-teste-123'};
function setup({duplicateMember=false,duplicateUser=false,conflict=false}={}){const writes=[],audit=[];const db={member:{findFirst:async()=>duplicateMember?{id:'existing-member'}:null,create:async args=>{if(conflict)throw {code:'P2002'};writes.push(args);return {id:'new-member'}}},user:{findFirst:async()=>duplicateUser?{id:'existing-user'}:null}};const service=load('src/server/visitor-registration.ts',{'@/lib/visitor-registration':validation,'@/server/db':{prisma:db},bcryptjs:require('bcryptjs'),'@/server/audit':{logAudit:async value=>audit.push(value)}});return {...service,writes,audit};}
test('Signup validates CPF digits and password byte length and rejects supplied privileges',()=>{
 assert.ok(validation.visitorRegistrationSchema.safeParse(input).success);
 for(const cpf of ['11111111111','52998224724','123'])assert.equal(validation.visitorRegistrationSchema.safeParse({...input,cpf}).success,false);
 assert.equal(validation.visitorRegistrationSchema.safeParse({...input,password:'short'}).success,false);
 assert.equal(validation.visitorRegistrationSchema.safeParse({...input,password:'é'.repeat(40)}).success,false);
 for(const malicious of [{roles:['SUPER_ADMIN']},{type:'PASTOR'},{ministryId:'kids'}])assert.equal(validation.visitorRegistrationSchema.safeParse({...input,...malicious}).success,false);
});
test('Signup atomically creates a VISITOR member and a hashed, unprivileged account',async()=>{
 const service=setup();const result=await service.registerVisitor(input);assert.equal(result.status,201);const data=service.writes[0].data;assert.equal(data.type,'VISITOR');assert.deepEqual(Array.from(data.types),['VISITOR']);assert.equal(data.cpf,'52998224725');assert.equal(data.email,'visitor@example.com');assert.equal(data.phone,'11999991234');assert.equal(data.user.create.roles.create.role,'MEMBER');assert.notEqual(data.user.create.passwordHash,input.password);assert.ok(await require('bcryptjs').compare(input.password,data.user.create.passwordHash));const serialized=JSON.stringify([result,service.audit]);assert.equal(serialized.includes(input.password),false);assert.equal(serialized.includes('52998224725'),false);
});
test('Existing CPF/email are never attached, overwritten or given a new password',async()=>{
 for(const options of [{duplicateMember:true},{duplicateUser:true}]){const service=setup(options);assert.equal((await service.registerVisitor(input)).status,409);assert.equal(service.writes.length,0);}
 const service=setup({conflict:true});assert.equal((await service.registerVisitor(input)).status,409);assert.equal(service.writes.length,0);
});
test('Public route rejects malformed/oversized bodies and rate limits repeated attempts',async()=>{
 let calls=0;const route=load('src/app/api/v1/auth/mobile/register/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,status:options.status})}},'@/server/visitor-registration':{registerVisitor:async()=>{calls++;return {ok:true,status:201}}}});
 const req=(body,ip='one')=>new Request('https://church.example/api/v1/auth/mobile/register',{method:'POST',headers:{'x-forwarded-for':ip},body});
 assert.equal((await route.POST(req('{','bad'))).status,400);assert.equal((await route.POST(req('x'.repeat(9000),'huge'))).status,413);assert.equal(calls,0);
 for(let i=0;i<5;i++)assert.equal((await route.POST(req('{}'))).status,201);
 assert.equal((await route.POST(req('{}'))).status,429);assert.equal(calls,5);
});
