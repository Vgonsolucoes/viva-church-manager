import { requireLoggedIn } from "@/server/session-helpers";
import { respondToSchedule } from "@/server/schedule-response";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { id } = await params;
  return respondToSchedule(auth.ctx, id, "CONFIRMED", { reason: "CONFIRMED" });
}
