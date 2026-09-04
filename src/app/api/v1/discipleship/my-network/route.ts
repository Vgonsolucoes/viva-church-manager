import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  requireLoggedIn,
  requirePermission,
} from "@/server/session-helpers";

export const dynamic = "force-dynamic";

type TreeNode = {
  id: string;
  fullName: string;
  photo: string | null;
  level: number;
  directCount: number;
  indirectCount: number;
  children: TreeNode[];
};

type RawMember = {
  id: string;
  fullName: string;
  photoUrl: string | null;
};

async function buildNetwork(
  rootMemberId: string,
  maxDepth: number,
): Promise<{ root: TreeNode; totalNodes: number }> {
  const rootMember = await prisma.member.findUnique({
    where: { id: rootMemberId },
    select: { id: true, fullName: true, photoUrl: true },
  });

  if (!rootMember) {
    throw new Error("ROOT_MEMBER_NOT_FOUND");
  }

  const disciplesByDiscipler = new Map<string, RawMember[]>();
  const memberMap = new Map<string, RawMember>();
  memberMap.set(rootMember.id, rootMember);

  let currentLevelIds: string[] = [rootMember.id];
  let currentDepth = 0;

  while (currentLevelIds.length > 0 && currentDepth < maxDepth) {
    const discipleships = await prisma.discipleship.findMany({
      where: {
        disciplerId: { in: currentLevelIds },
        status: "ACTIVE",
      },
      include: {
        disciple: {
          select: { id: true, fullName: true, photoUrl: true },
        },
      },
    });

    const nextLevelIds: string[] = [];

    for (const ds of discipleships) {
      if (!disciplesByDiscipler.has(ds.disciplerId)) {
        disciplesByDiscipler.set(ds.disciplerId, []);
      }
      disciplesByDiscipler.get(ds.disciplerId)!.push(ds.disciple);

      if (!memberMap.has(ds.disciple.id)) {
        memberMap.set(ds.disciple.id, ds.disciple);
        nextLevelIds.push(ds.disciple.id);
      }
    }

    currentLevelIds = nextLevelIds;
    currentDepth += 1;
  }

  function computeCounts(
    nodeId: string,
    level: number,
    visited: Set<string>,
  ): TreeNode | null {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const member = memberMap.get(nodeId);
    if (!member) return null;

    const childrenRaw = disciplesByDiscipler.get(nodeId) ?? [];
    const children: TreeNode[] = [];

    let indirectSum = 0;
    for (const childRaw of childrenRaw) {
      const childNode = computeCounts(childRaw.id, level + 1, visited);
      if (childNode) {
        children.push(childNode);
        indirectSum += childNode.directCount + childNode.indirectCount;
      }
    }

    return {
      id: member.id,
      fullName: member.fullName,
      photo: member.photoUrl,
      level,
      directCount: children.length,
      indirectCount: indirectSum,
      children,
    };
  }

  const root = computeCounts(rootMember.id, 0, new Set());
  if (!root) {
    throw new Error("FAILED_TO_BUILD_NETWORK");
  }

  function countNodes(node: TreeNode): number {
    return 1 + node.children.reduce((acc, c) => acc + countNodes(c), 0);
  }

  return {
    root,
    totalNodes: countNodes(root),
  };
}

export async function GET(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const permError = requirePermission(ctx, "discipleship:my:read");
  if (permError) return permError;

  if (!ctx.member) {
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const depthParam = searchParams.get("depth");
  const depth = depthParam ? parseInt(depthParam, 10) : 5;
  const safeDepth = Number.isFinite(depth) && depth > 0 ? Math.min(depth, 10) : 5;

  const network = await buildNetwork(ctx.member.id, safeDepth);

  return NextResponse.json(network);
}
