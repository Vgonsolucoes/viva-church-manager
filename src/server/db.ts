import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function requireConnectionString() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  return connectionString;
}

function createPrismaClient() {
  const connectionString = requireConnectionString();
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function hasModelField(client: PrismaClient | undefined, modelName: string, fieldName: string) {
  const anyClient = client as unknown as {
    _dmmf?: { datamodel?: { models?: Array<{ name: string; fields: Array<{ name: string }> }> } };
  };

  const models = anyClient?._dmmf?.datamodel?.models;
  if (!Array.isArray(models)) return false;
  const model = models.find((m) => m.name === modelName);
  if (!model) return false;
  return model.fields.some((f) => f.name === fieldName);
}

function hasCurrentClient(client: PrismaClient | undefined) {
  if (!client) return false;

  const requiredDelegates = ["course", "eventSale", "memberMinistry", "followUpJourney"] as const;
  const delegatesOk = requiredDelegates.every((delegate) => delegate in client);
  if (!delegatesOk) return false;

  const requiredModelFields = [
    { model: "Member", field: "types" },
    { model: "Member", field: "cpf" },
    { model: "Event", field: "bannerImageUrl" },
    { model: "Course", field: "bannerImageUrl" },
    { model: "FollowUpJourney", field: "stage" },
  ] as const;

  return requiredModelFields.every((item) => hasModelField(client, item.model, item.field));
}

const existingPrisma = hasCurrentClient(globalForPrisma.prisma)
  ? globalForPrisma.prisma
  : undefined;

export const prisma: PrismaClient = existingPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
