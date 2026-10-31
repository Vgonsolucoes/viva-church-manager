import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { getAccessConfig } from "@/server/access-control";
import { AccessEditor } from "./AccessEditor";

export default async function AccessPage() {
  const session = await getServerSession(authOptions);
  if (!session?.roles?.includes("SUPER_ADMIN")) redirect("/admin");
  const [config, ministries] = await Promise.all([getAccessConfig(), prisma.ministry.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } })]);
  return <AccessEditor initialConfig={config} ministries={ministries} />;
}
