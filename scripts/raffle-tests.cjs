const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies) {
  const exports = {};
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, { exports, require: (id) => dependencies[id], Response, Date });
  return exports;
}

test('A member receives a private number, a duplicate is blocked and only a paid ticket can close the raffle', async () => {
  const tickets = new Map();
  const notifications = [];
  let result = null;
  const raffle = { id: 'raffle', title: 'Sorteio', authorization: 'certificado', firstNumber: 1, lastNumber: 20, priceCents: 1250 };
  const tx = {
    $queryRaw: async () => [],
    raffle: { findUnique: async () => ({ ...raffle, result }) },
    member: { findUnique: async () => ({ id: 'member', fullName: 'Participante', user: { id: 'user' } }) },
    raffleTicket: {
      findUnique: async ({ where }) => tickets.get(where.raffleId_number.number),
      create: async ({ data }) => {
        const ticket = { ...data, paidAt: null };
        tickets.set(ticket.number, ticket);
        return ticket;
      },
      count: async ({ where }) => [...tickets.values()].filter((ticket) => !where.paidAt || ticket.paidAt).length,
    },
    notification: { create: async ({ data }) => notifications.push(data) },
    raffleResult: { create: async ({ data }) => { result = data; return result; } },
  };
  const service = load('src/server/raffles.ts', { '@/server/db': { prisma: { $transaction: (fn) => fn(tx) } } });
  await assert.rejects(service.reserveRaffleTicket('raffle', 21, 'member', '', 'operator'), /faixa/);
  const ticket = await service.reserveRaffleTicket('raffle', 7, 'member', 'Outro nome', 'operator');
  assert.equal(ticket.participantName, 'Participante');
  assert.equal(notifications[0].deliveries.create.userId, 'user');
  assert.match(notifications[0].body, /Nº 7/);
  await assert.rejects(service.reserveRaffleTicket('raffle', 7, '', 'Convidado', 'operator'), /reservado/);
  await service.reserveRaffleTicket('raffle', 8, '', 'Convidado', 'operator');
  await assert.rejects(service.recordRaffleResult('raffle', 7, 'Extração', 'operator'), /pago/);
  ticket.paidAt = new Date();
  await service.recordRaffleResult('raffle', 7, 'Extração', 'operator');
  assert.equal(result.winnerName, 'Participante');
  assert.equal(result.raisedCents, 1250);
  assert.equal(result.reservedCount, 2);
  await assert.rejects(service.recordRaffleResult('raffle', 7, 'Extração', 'operator'), /alterações/);
});

test('The mobile endpoint uses the authenticated member and does not return the winner identity', async () => {
  let filter;
  let modules = ['raffles'];
  const { GET } = load('src/app/api/v1/raffles/my/route.ts', {
    '@/server/session-helpers': { requireLoggedIn: async () => ({ ok: true, ctx: { member: { id: 'mine' }, access: { mobileModules: modules } } }) },
    '@/server/db': { prisma: { raffleTicket: { findMany: async ({ where }) => {
      filter = where.memberId;
      return [{ id: 'ticket', number: 7, paidAt: null, raffle: { title: 'Sorteio', prize: 'Livro', priceCents: 100, result: { winningNumber: 8, winnerName: 'Outro participante' } } }];
    } } } },
  });
  const response = await GET(new Request('https://test.invalid/api/v1/raffles/my?memberId=other'));
  assert.equal(filter, 'mine');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), [{ id: 'ticket', number: 7, paid: false, title: 'Sorteio', prize: 'Livro', priceCents: 100, closed: true, won: false }]);
  modules = [];
  assert.equal((await GET(new Request('https://test.invalid/api/v1/raffles/my'))).status, 403);
});
