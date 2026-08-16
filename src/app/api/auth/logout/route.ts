import { handle, ok } from "@/lib/http";
import { destroyCurrentSession, getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

export const POST = handle(async (req) => {
  const user = await getCurrentUser();
  await destroyCurrentSession();
  if (user) await audit({ action: "user.logout", actorId: user.id, ip: clientIp(req) });
  return ok({ redirect: "/" });
});
