import "server-only";
import { cookies } from "next/headers";
import { seedAllowed } from "@/lib/e2e-seed";

/** e2e only: a cookie makes the send fail. Never honoured on a deployed service. */
export async function mailForcedToFail() {
  if (!seedAllowed(process.env)) return false;
  return (await cookies()).has("e2e_mail_fail");
}
