import bcrypt from "bcryptjs";
import { PrismaClient, RoleKey, MemberType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const email = (process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@vivachurch.local")
    .toLowerCase()
    .trim();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";

  const passwordHash = await bcrypt.hash(password, 12);

  const member = await prisma.member.upsert({
    where: { email },
    update: { fullName: "Super Admin", type: MemberType.LEADER },
    create: { fullName: "Super Admin", email, type: MemberType.LEADER },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: "Super Admin", passwordHash, memberId: member.id },
    create: { email, name: "Super Admin", passwordHash, memberId: member.id },
  });

  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: RoleKey.SUPER_ADMIN } },
    update: {},
    create: { userId: user.id, role: RoleKey.SUPER_ADMIN },
  });

  await prisma.ministry.upsert({
    where: { name: "Geral" },
    update: {},
    create: { name: "Geral", description: "Ministério padrão" },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    await prisma.$disconnect();
    throw e;
  });
