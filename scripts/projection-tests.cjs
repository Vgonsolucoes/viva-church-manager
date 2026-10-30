// Regressões de autorização: executa o serviço real com banco e auditoria isolados.
require('tsx/cjs');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');
let currentMember = null;
let parkingWrites = [];
let kidsWrites = [];
let checkedInChildren = [{ child: { id: 'child-1', fullName: 'Criança Exemplo' } }];
let authUid = null;
let authRoles = [];
const db = {
  user: { findUnique: async () => ({ member: currentMember }) },
  parkingProjectionMessage: { create: async ({ data }) => { parkingWrites.push(data); return { id: 'parking-1' }; } },
  kidsProjectionMessage: { create: async ({ data }) => { kidsWrites.push(data); return { id: 'kids-1' }; } },
  childCheckIn: { findMany: async () => checkedInChildren },
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@/server/db') return { prisma: db };
  if (request === '@/server/session-helpers') return { requireLoggedIn: async () => authUid
    ? { ok: true, ctx: { user: { id: authUid }, roles: authRoles } }
    : { ok: false, error: new Response(null, { status: 401 }) } };
  if (request === '@/server/audit') return { logAudit: async () => {} };
  if (request === '@/server/kids-services') return { getActiveKidsService: async () => ({ ok: true, service: { id: 'service-1' } }) };
  if (request === '@/server/kids-close') return { closeEndedKidsSessions: async () => {} };
  return originalLoad.call(this, request, parent, isMain);
};
const { accessFromMinistries, projectionRequestSchema } = require('../src/lib/projection.ts');
const { createProjectionRequest } = require('../src/server/projection-requests.ts');
const { getProjectionAccess } = require('../src/server/projection-access.ts');
const requestsRoute = require('../src/app/api/v1/projection/requests/route.ts');
const viewedRoute = require('../src/app/api/v1/projection/messages/[id]/view/route.ts');
const member = (channel, active = true) => ({ ministry: null, ministriesLeading: [], memberMinistries: [{ ministry: { active, projectionChannel: channel } }] });

test('vínculo ativo é obrigatório; os canais não concedem acesso entre si', () => {
  assert.deepEqual(accessFromMinistries([]), { KIDS: false, PARKING: false });
  assert.deepEqual(accessFromMinistries([{ active: false, projectionChannel: 'KIDS' }]), { KIDS: false, PARKING: false });
  assert.deepEqual(accessFromMinistries([{ active: true, projectionChannel: 'PARKING' }]), { KIDS: false, PARKING: true });
});
test('placas antigas e Mercosul são normalizadas; placas inválidas são rejeitadas', () => {
  for (const plate of ['abc-1234', 'abc1d23']) assert.equal(projectionRequestSchema.parse({ channel: 'PARKING', plate }).plate, plate.toUpperCase().replace('-', ''));
  for (const plate of ['ABC', '1234567', 'ABCDEFG']) assert.equal(projectionRequestSchema.safeParse({ channel: 'PARKING', plate }).success, false);
});
test('considera vínculos principal, de liderança e de voluntário sem misturar os canais', async () => {
  currentMember = { ...member('PARKING', false), ministry: { active: true, projectionChannel: 'KIDS' } };
  assert.deepEqual(await getProjectionAccess('u1'), { KIDS: true, PARKING: false });
  currentMember = { ministry: null, memberMinistries: [], ministriesLeading: [{ active: true, projectionChannel: 'PARKING' }], volunteerProfile: { ministry: { active: true, projectionChannel: 'KIDS' } } };
  assert.deepEqual(await getProjectionAccess('u1'), { KIDS: true, PARKING: true });
});
test('serviço bloqueia não integrantes, troca de canal e vínculo removido, sem gravar avisos', async () => {
  parkingWrites = []; kidsWrites = [];
  const input = { channel: 'PARKING', plate: 'abc1d23' };
  currentMember = null;
  assert.equal((await createProjectionRequest('admin-sem-vinculo', input)).status, 403);
  currentMember = member('KIDS');
  assert.equal((await createProjectionRequest('kids-user', input)).status, 403);
  currentMember = member('PARKING', false);
  assert.equal((await createProjectionRequest('parking-user', input)).status, 403);
  assert.equal(parkingWrites.length, 0);
  currentMember = member('PARKING');
  assert.equal((await createProjectionRequest('parking-user', input)).ok, true);
  assert.equal(parkingWrites[0].plate, 'ABC1D23');
  currentMember = null;
  assert.equal((await createProjectionRequest('parking-user', input)).status, 403);
  assert.equal(parkingWrites.length, 1);
});
test('Kids exige vínculo e check-in ativo antes de enviar', async () => {
  const input = { channel: 'KIDS', childId: 'child-1', message: 'Responsável, compareça ao Kids.' };
  currentMember = member('PARKING');
  assert.equal((await createProjectionRequest('parking-user', input)).status, 403);
  currentMember = member('KIDS');
  checkedInChildren = [];
  assert.equal((await createProjectionRequest('kids-user', input)).status, 400);
  checkedInChildren = [{ child: { id: 'child-1', fullName: 'Criança Exemplo' } }];
  const result = await createProjectionRequest('kids-user', input);
  assert.equal(result.ok, true);
  assert.equal(kidsWrites.at(-1).childId, 'child-1');
});
test('API bloqueia acesso direto sem sessão, canal indevido e confirmação por remetentes', async () => {
  authUid = null;
  assert.equal((await requestsRoute.GET(new Request('http://localhost/api/v1/projection/requests?channel=KIDS'))).status, 401);
  authUid = 'kids-user'; authRoles = ['KIDS_MINISTRY']; currentMember = member('KIDS');
  assert.equal((await requestsRoute.GET(new Request('http://localhost/api/v1/projection/requests?channel=PARKING'))).status, 403);
  assert.equal((await requestsRoute.POST(new Request('http://localhost/api/v1/projection/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'PARKING', plate: 'ABC1D23' }) }))).status, 403);
  authRoles = ['MEMBER'];
  const res = await viewedRoute.POST(new Request('http://localhost/api/v1/projection/messages/parking-1/view', { method: 'POST', body: JSON.stringify({ channel: 'PARKING' }) }), { params: Promise.resolve({ id: 'parking-1' }) });
  assert.equal(res.status, 403);
});
