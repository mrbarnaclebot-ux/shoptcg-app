import { isDeployed } from "@/lib/deployed";

/** The e2e seed route answers only when asked for and never on a deployed service. */
export function seedAllowed(env: Record<string, string | undefined>) {
  return env.E2E_SEED === "1" && !isDeployed(env);
}
