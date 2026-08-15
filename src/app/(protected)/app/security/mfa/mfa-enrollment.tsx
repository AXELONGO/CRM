"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Enrollment = { totpURI: string; backupCodes: string[] };

export function MfaEnrollment({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function enable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/two-factor/enable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: String(form.get("password")) }),
    });
    setLoading(false);
    if (!response.ok) {
      setError("No se pudo iniciar la configuracion. Verifica tu contrasena.");
      return;
    }
    setEnrollment((await response.json()) as Enrollment);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/two-factor/verify-totp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: String(form.get("code")), trustDevice: false }),
    });
    setLoading(false);
    if (!response.ok) {
      setError("El codigo no es valido. Revisa la hora de tu autenticador.");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <section className="mx-auto max-w-2xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">Protege tu cuenta</h1>
        <p className="mt-4 text-sm text-[var(--crm-muted)]">
          Configura una aplicacion autenticadora antes de continuar con permisos
          privilegiados.
        </p>

        {enabled ? (
          <div className="mt-8 rounded-lg border border-green-300 bg-green-50 p-5">
            <p className="font-medium text-green-900">MFA esta activo.</p>
            <Link className="mt-4 inline-block underline" href="/app">
              Continuar al CRM
            </Link>
          </div>
        ) : enrollment ? (
          <div className="mt-8 space-y-6">
            <div>
              <h2 className="font-semibold">1. Agrega la cuenta</h2>
              <p className="mt-2 text-sm text-[var(--crm-muted)]">
                Abre este URI con tu autenticador o copia su secreto manualmente.
              </p>
              <output className="mt-3 block break-all rounded-lg border bg-slate-50 p-3 text-xs">
                {enrollment.totpURI}
              </output>
            </div>
            <div>
              <h2 className="font-semibold">2. Guarda los codigos de recuperacion</h2>
              <ul className="mt-3 grid gap-2 rounded-lg border p-4 font-mono text-sm sm:grid-cols-2">
                {enrollment.backupCodes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            </div>
            <form className="space-y-4" onSubmit={verify}>
              <label className="block text-sm font-medium" htmlFor="mfa-code">
                3. Codigo de autenticacion
                <input
                  required
                  autoComplete="one-time-code"
                  className="mt-2 w-full rounded-lg border p-3"
                  id="mfa-code"
                  inputMode="numeric"
                  maxLength={6}
                  minLength={6}
                  name="code"
                  pattern="[0-9]{6}"
                />
              </label>
              <button
                className="w-full rounded-lg bg-[var(--crm-primary)] px-4 py-3 font-medium text-white disabled:opacity-60"
                disabled={loading}
                type="submit"
              >
                {loading ? "Verificando..." : "Activar MFA"}
              </button>
            </form>
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={enable}>
            <label className="block text-sm font-medium" htmlFor="mfa-password">
              Confirma tu contrasena
              <input
                required
                autoComplete="current-password"
                className="mt-2 w-full rounded-lg border p-3"
                id="mfa-password"
                name="password"
                type="password"
              />
            </label>
            <button
              className="w-full rounded-lg bg-[var(--crm-primary)] px-4 py-3 font-medium text-white disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "Preparando..." : "Configurar autenticador"}
            </button>
          </form>
        )}
        {error ? (
          <p className="mt-5 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
