import { createHash, randomUUID } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const sourceUrl =
  process.env.RESTORE_SOURCE_DATABASE_URL ??
  process.env.TEST_DATABASE_MIGRATION_URL ??
  "postgresql://crm_test_migration:crm_test_migration_password@127.0.0.1:5433/crm_test";
const container = process.env.RESTORE_DRILL_CONTAINER ?? "crmpersonal-postgres-test-1";
const drillId = randomUUID().replaceAll("-", "").slice(0, 16);
const targetContainer = `crm-restore-drill-pg-${drillId}`;
const databaseName = `crm_restore_drill_${drillId}`;
const directory = mkdtempSync(join(tmpdir(), `crm-restore-drill-${drillId}-`));
const sourceStorage = join(directory, "storage-source");
const restoredStorage = join(directory, "storage-restored");
const archive = join(directory, `${databaseName}.dump`);
const manifestPath = join(directory, "manifest.json");
const sourceObject = join(sourceStorage, "tenant-a", "synthetic", "evidence.bin");
const restoredObject = join(restoredStorage, "tenant-a", "synthetic", "evidence.bin");

function run(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  return execFileSync(command, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function checksum(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertLocalDatabase(url: string) {
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error("RESTORE_DRILL_DATABASE_MUST_BE_LOCAL");
  }
}

function destinationUrl() {
  const parsed = new URL(sourceUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

function execDocker(args: string[]) {
  return run("docker", ["exec", container, ...args]);
}

function execTarget(args: string[]) {
  return run("docker", ["exec", targetContainer, ...args]);
}

function execDockerBuffer(args: string[]) {
  return execFileSync("docker", ["exec", container, ...args], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function setSourceForce(enabled: boolean) {
  execDocker([
    "psql",
    "-U",
    "crm_test_migration",
    "-d",
    "crm_test",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `do $body$ declare relation_name text; begin for relation_name in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and exists (select 1 from information_schema.columns col where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'tenant_id') loop execute format('alter table %I %s row level security', relation_name, ${enabled ? "'FORCE'" : "'NO FORCE'"}); end loop; end $body$;`,
  ]);
}

assertLocalDatabase(sourceUrl);
if (!existsSync(join(process.cwd(), "drizzle", "meta", "_journal.json"))) {
  throw new Error("RESTORE_DRILL_SCHEMA_JOURNAL_MISSING");
}

try {
  run("docker", ["inspect", container]);
  run("docker", [
    "run",
    "--detach",
    "--name",
    targetContainer,
    "-e",
    "POSTGRES_PASSWORD=restore_drill_password",
    "-e",
    `POSTGRES_DB=${databaseName}`,
    "postgres:17-alpine",
  ]);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      execTarget(["pg_isready", "-U", "postgres", "-d", databaseName]);
      break;
    } catch {
      if (attempt === 29) throw new Error("RESTORE_TARGET_POSTGRES_NOT_READY");
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  execTarget([
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "create role crm_runtime nologin; create role crm_worker nologin; create role crm_ingress nologin; create role crm_test_runtime nologin;",
  ]);
  setSourceForce(false);
  try {
    writeFileSync(
      archive,
      execDockerBuffer([
        "pg_dump",
        "-U",
        "crm_test_migration",
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--dbname",
        "crm_test",
      ]),
    );
  } finally {
    setSourceForce(true);
  }

  const bytes = Buffer.from("CRM Prompt 21 synthetic private evidence\n", "utf8");
  const sourceObjectHash = createHash("sha256").update(bytes).digest("hex");
  mkdirSync(join(sourceStorage, "tenant-a", "synthetic"), { recursive: true });
  writeFileSync(sourceObject, bytes, { flag: "w" });
  writeFileSync(
    manifestPath,
    JSON.stringify({
      drillId,
      databaseName,
      sourceDatabase: new URL(sourceUrl).pathname.slice(1),
      schemaJournal: readFileSync(
        join(process.cwd(), "drizzle", "meta", "_journal.json"),
        "utf8",
      ).length,
      archiveSha256: checksum(archive),
      objects: [
        {
          key: "tenant-a/synthetic/evidence.bin",
          sha256: sourceObjectHash,
          bytes: bytes.byteLength,
        },
      ],
      createdAt: new Date().toISOString(),
    }),
  );

  const containerArchive = `/tmp/${databaseName}.dump`;
  run("docker", ["cp", archive, `${targetContainer}:${containerArchive}`]);
  execTarget([
    "pg_restore",
    "-U",
    "postgres",
    "--exit-on-error",
    "--no-owner",
    "--no-privileges",
    "--dbname",
    databaseName,
    containerArchive,
  ]);
  cpSync(sourceStorage, restoredStorage, { recursive: true });

  if (
    checksum(archive) !== JSON.parse(readFileSync(manifestPath, "utf8")).archiveSha256
  ) {
    throw new Error("RESTORE_ARCHIVE_CHECKSUM_MISMATCH");
  }
  if (checksum(restoredObject) !== sourceObjectHash)
    throw new Error("RESTORE_OBJECT_CHECKSUM_MISMATCH");
  const result = execTarget([
    "psql",
    "-U",
    "postgres",
    "-d",
    databaseName,
    "-Atc",
    "select current_database(), count(*) from drizzle.__drizzle_migrations",
  ]);
  if (!result.includes(`${databaseName}|`))
    throw new Error("RESTORE_DATABASE_IDENTITY_MISMATCH");

  const originalManifest = readFileSync(manifestPath, "utf8");
  writeFileSync(manifestPath, originalManifest.replace(sourceObjectHash, "bad"));
  if (
    checksum(restoredObject) ===
    JSON.parse(readFileSync(manifestPath, "utf8")).objects[0].sha256
  ) {
    throw new Error("RESTORE_FAILURE_INJECTION_NOT_DETECTED");
  }
  writeFileSync(manifestPath, originalManifest);
  rmSync(restoredObject);
  if (existsSync(restoredObject))
    throw new Error("RESTORE_MISSING_OBJECT_FAILURE_NOT_DETECTED");

  console.log(
    JSON.stringify({
      status: "passed",
      drillId,
      databaseName,
      archiveSha256: checksum(archive),
      objectSha256: sourceObjectHash,
      failureInjection: "checksum-and-missing-object-detected",
    }),
  );
} finally {
  try {
    setSourceForce(true);
  } catch {
    console.error("Restore drill could not re-enable source FORCE RLS.");
    process.exitCode = 1;
  }
  try {
    run("docker", ["rm", "--force", targetContainer]);
  } catch {
    console.error(`Restore drill cleanup failed for database ${databaseName}.`);
    process.exitCode = 1;
  }
  rmSync(directory, { recursive: true, force: true });
}
