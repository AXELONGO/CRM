import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { eq } from "drizzle-orm";
import { getEnvironment } from "@/infrastructure/config/env";
import { closeDatabase, getDatabase } from "@/infrastructure/database/client";
import { user, platformAdministrators } from "@/infrastructure/database/schema";
import { appendAuditEvent } from "@/modules/tenancy/infrastructure/repositories";
import { withUserDatabase } from "@/infrastructure/database/tenant";

async function main() {
  const environment = getEnvironment();
  if (
    environment.NODE_ENV === "production" ||
    !environment.PLATFORM_ADMIN_BOOTSTRAP_ENABLED
  ) {
    throw new Error(
      "El bootstrap de plataforma solo funciona fuera de produccion con PLATFORM_ADMIN_BOOTSTRAP_ENABLED=true.",
    );
  }

  const readline = createInterface({ input, output });
  const suppliedEmail = process.env.PLATFORM_ADMIN_EMAIL;
  const email = (
    suppliedEmail ?? (await readline.question("Correo verificado de Better Auth: "))
  )
    .trim()
    .toLowerCase();
  readline.close();

  const db = getDatabase();
  const [candidate] = await db
    .select({ id: user.id, email: user.email, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!candidate || !candidate.emailVerified) {
    throw new Error("El usuario debe existir y tener el correo verificado.");
  }

  await withUserDatabase(db, candidate.id, async (tx) => {
    const existing = await tx
      .select({ userId: platformAdministrators.userId })
      .from(platformAdministrators)
      .limit(1);
    if (existing.length > 0) {
      if (existing[0].userId === candidate.id) return;
      throw new Error(
        "Ya existe un administrador de plataforma; el bootstrap se detiene.",
      );
    }

    await tx.insert(platformAdministrators).values({ userId: candidate.id });
    await appendAuditEvent(tx, {
      actorUserId: candidate.id,
      eventType: "platform.admin_bootstrapped",
      targetType: "platform_administrator",
      targetId: candidate.id,
      result: "success",
    });
  });

  console.log(
    "Administrador de plataforma creado. Desactiva PLATFORM_ADMIN_BOOTSTRAP_ENABLED.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "No se pudo completar el bootstrap.",
    );
    process.exitCode = 1;
  })
  .finally(closeDatabase);
