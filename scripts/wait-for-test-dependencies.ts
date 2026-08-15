import postgres from "postgres";

const databaseURL = process.env.DATABASE_URL;
const mailpitURL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";
const timeoutMs = 30_000;
const retryMs = 250;

if (!databaseURL) {
  throw new Error("DATABASE_URL es obligatoria para las pruebas E2E.");
}
const databaseConnectionURL: string = databaseURL;

async function checkDatabase() {
  const sql = postgres(databaseConnectionURL, {
    connect_timeout: 2,
    max: 1,
    prepare: false,
  });
  try {
    await sql`select 1`;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

async function checkMailpit() {
  const response = await fetch(`${mailpitURL}/api/v1/info`, {
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) {
    throw new Error(`Mailpit respondio con HTTP ${response.status}.`);
  }
}

async function waitForDependencies() {
  const deadline = Date.now() + timeoutMs;
  let lastError = "sin diagnostico";

  while (Date.now() < deadline) {
    try {
      await checkDatabase();
      await checkMailpit();
      console.log("PostgreSQL y Mailpit estan listos para E2E.");
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "error desconocido";
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    }
  }

  throw new Error(`Dependencias E2E no listas en ${timeoutMs} ms: ${lastError}`);
}

waitForDependencies().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "No se pudo comprobar readiness.",
  );
  process.exitCode = 1;
});
