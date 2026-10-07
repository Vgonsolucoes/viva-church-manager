import { SignJWT } from "jose";
import { requireNextAuthSecret } from "@/server/auth-jwt";
import { KidsSubNav } from "../KidsSubNav";
import { KidsCheckinQrPoster } from "./KidsCheckinQrPoster";

export const dynamic = "force-dynamic";

export default async function KidsCheckinQrPage() {
  const secret = requireNextAuthSecret();

  // QR fixo da parede: JWT HS256 sem expiração, sem dados pessoais.
  // A revogação (se necessária) ocorre pela rotação do NEXTAUTH_SECRET.
  const token = await new SignJWT({
    sub: "kids-checkin-point",
    type: "kids-checkin-point",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .sign(secret);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Ministério Infantil</div>
        <div className="mt-1 text-sm text-muted-foreground">
          QR Code fixo de check-in para impressão e fixação na entrada do Ministério Infantil.
        </div>
      </div>

      <KidsSubNav />

      <KidsCheckinQrPoster token={token} />
    </div>
  );
}
