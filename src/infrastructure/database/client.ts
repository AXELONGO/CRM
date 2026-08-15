import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { requireDatabaseUrl } from "@/infrastructure/config/env";
import { getEnvironment } from "@/infrastructure/config/env";

import * as schema from "@/infrastructure/database/schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let database: Database | undefined;
let sqlClient: ReturnType<typeof postgres> | undefined;
let ingressDatabase: Database | undefined;
let ingressSqlClient: ReturnType<typeof postgres> | undefined;
let workerDatabase: Database | undefined;
let workerSqlClient: ReturnType<typeof postgres> | undefined;

export function getDatabase(): Database {
  if (database) {
    return database;
  }

  const sql = postgres(requireDatabaseUrl(), {
    prepare: false,
  });
  sqlClient = sql;
  database = drizzle(sql, { schema });
  return database;
}

export function getIngressDatabase(): Database {
  if (ingressDatabase) return ingressDatabase;
  const url = getEnvironment().DATABASE_INGRESS_URL;
  if (!url) throw new Error("DATABASE_INGRESS_URL_REQUIRED");
  ingressSqlClient = postgres(url, { prepare: false, max: 5 });
  ingressDatabase = drizzle(ingressSqlClient, { schema });
  return ingressDatabase;
}

export function getWorkerDatabase(): Database {
  if (workerDatabase) return workerDatabase;
  const url = getEnvironment().DATABASE_WORKER_URL;
  if (!url) throw new Error("DATABASE_WORKER_URL_REQUIRED");
  workerSqlClient = postgres(url, { prepare: false, max: 5 });
  workerDatabase = drizzle(workerSqlClient, { schema });
  return workerDatabase;
}

export async function closeDatabase(): Promise<void> {
  await sqlClient?.end({ timeout: 2 });
  sqlClient = undefined;
  database = undefined;
  await ingressSqlClient?.end({ timeout: 2 });
  ingressSqlClient = undefined;
  ingressDatabase = undefined;
  await workerSqlClient?.end({ timeout: 2 });
  workerSqlClient = undefined;
  workerDatabase = undefined;
}
