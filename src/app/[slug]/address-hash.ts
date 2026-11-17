import "server-only";
import { headers } from "next/headers";
import { outboxPath } from "@/lib/email";
import { ipHash } from "@/lib/request-limit";
import { clientIp } from "@/lib/sign-in-limit";

/** The buyer's address, hashed for the per-address limits; e2e sends from one machine, so none there. */
export async function addressHash() {
  const ip = outboxPath(process.env) ? null : clientIp(await headers());
  const secret = process.env.BETTER_AUTH_SECRET;
  return ip && secret ? ipHash(ip, secret) : null;
}
