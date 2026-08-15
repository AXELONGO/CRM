import { getIngressDatabase } from "@/infrastructure/database/client";
import { getPublicPaymentRequest } from "@/modules/payments/infrastructure/repositories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicPaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payment = await getPayment(token);
  if (!payment) {
    return (
      <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-16">
        <section className="mx-auto max-w-lg rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-7 text-center shadow-sm sm:p-10">
          <h1 className="text-2xl font-semibold">Liga no disponible</h1>
          <p className="mt-3 text-sm text-[var(--crm-muted)]">
            La liga no es válida, expiró o ya no está disponible.
          </p>
        </section>
      </main>
    );
  }
  return <PaymentDetails token={token} payment={payment} />;
}

async function getPayment(token: string) {
  try {
    return await getIngressDatabase().transaction((tx) =>
      getPublicPaymentRequest(tx, token),
    );
  } catch {
    return null;
  }
}

function PaymentDetails({
  token,
  payment,
}: {
  token: string;
  payment: Awaited<ReturnType<typeof getPublicPaymentRequest>>;
}) {
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-16">
      <section className="mx-auto max-w-lg rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-7 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">
          Liga de pago
        </p>
        <h1 className="mt-4 text-3xl font-semibold">Pago solicitado</h1>
        <p className="mt-3 text-sm text-[var(--crm-muted)]">
          El checkout se procesa en una página alojada por el proveedor. El CRM
          verificará el resultado después de tu regreso.
        </p>
        <div className="mt-8 rounded-xl border border-[var(--crm-border)] p-5">
          <p className="text-sm text-[var(--crm-muted)]">Concepto</p>
          <p className="mt-1 font-medium">{payment.description}</p>
          <p className="mt-5 text-sm text-[var(--crm-muted)]">Importe</p>
          <p className="mt-1 text-3xl font-semibold">
            {payment.amountMinor} {payment.currency}
          </p>
        </div>
        {payment.status === "paid" ? (
          <p className="mt-7 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-center font-semibold text-green-900">
            Pago confirmado. Gracias.
          </p>
        ) : (
          <form
            action={`/api/public/payments/${encodeURIComponent(token)}/continue`}
            method="post"
          >
            <button
              className="mt-7 w-full rounded-lg bg-[var(--crm-primary)] px-4 py-3 font-semibold text-white"
              type="submit"
            >
              Continuar al pago
            </button>
          </form>
        )}
        <p className="mt-5 text-center text-xs text-[var(--crm-muted)]">
          Esta liga no es una factura ni un comprobante fiscal.
        </p>
      </section>
    </main>
  );
}
