import { rm } from "node:fs/promises";
import { OUTBOX } from "../playwright.config";

// Links from a previous run must never satisfy this run's sign-in wait.
export default async function globalSetup() {
  await rm(OUTBOX, { force: true });
}
