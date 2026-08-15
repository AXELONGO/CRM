import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getEnvironment } from "@/infrastructure/config/env";
import { auth } from "@/infrastructure/auth/auth";
import { emailSender } from "@/infrastructure/email/smtp-email-sender";
import { closeDatabase } from "@/infrastructure/database/client";

async function hiddenQuestion(question: string): Promise<string> {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error(
      "El bootstrap requiere una terminal interactiva para ocultar la contrasena.",
    );
  }

  output.write(question);
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: Buffer) => {
      const character = chunk.toString("utf8");
      if (character.includes("\u0003")) {
        cleanup();
        reject(new Error("Bootstrap cancelado."));
        return;
      }
      const lineBreak = character.search(/[\r\n]/);
      if (lineBreak >= 0) {
        value += character.slice(0, lineBreak);
        cleanup();
        output.write("\n");
        resolve(value);
        return;
      }
      if (character === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += character;
    };
    const cleanup = () => {
      input.setRawMode(false);
      input.pause();
      input.off("data", onData);
    };
    input.on("data", onData);
  });
}

async function main() {
  const environment = getEnvironment();
  if (environment.NODE_ENV === "production" || !environment.AUTH_BOOTSTRAP_ENABLED) {
    throw new Error(
      "El bootstrap solo funciona fuera de produccion con AUTH_BOOTSTRAP_ENABLED=true.",
    );
  }

  const readline = createInterface({ input, output });
  const email = (await readline.question("Correo local: ")).trim().toLowerCase();
  const name = (await readline.question("Nombre: ")).trim();
  readline.close();
  const password = await hiddenQuestion("Contrasena (no se mostrara): ");

  if (!email || !name || password.length < 12 || password.length > 128) {
    throw new Error(
      "Correo, nombre y contrasena deben ser validos; la contrasena requiere 12 a 128 caracteres.",
    );
  }

  try {
    await auth.api.signUpEmail({
      body: { email, name, password },
      headers: new Headers({ "x-crm-bootstrap": "true" }),
    });
    await emailSender.waitForPending();
  } catch {
    throw new Error(
      "No se pudo crear el usuario local. Puede que el correo ya exista o que los datos no sean validos.",
    );
  }

  console.log("Usuario local creado. Revisa Mailpit para verificar el correo.");
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "No se pudo completar el bootstrap.",
    );
    process.exitCode = 1;
  })
  .finally(closeDatabase);
