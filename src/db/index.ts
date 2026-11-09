import "server-only";
import { sharedDb, type Db } from "./open";

export type { Db };

export const getDb = sharedDb;
