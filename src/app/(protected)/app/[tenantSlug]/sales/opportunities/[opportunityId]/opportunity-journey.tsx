"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

const quoteStatusLabels: Record<string, string> = {
  draft: "Borrador",
  issued: "Emitida",
  viewed: "Vista",
  accepted: "Aceptada",
  declined: "Rechazada",
  expired: "Expirada",
  changes_requested: "Cambios solicitados",
};

function postApi(path: string, body?: Record<string, unknown>) {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

type Quote = {
  id: string;
  number: string | null;
  status: string;
  title: string;
  currency: string;
  opportunityId: string | null;
  totalMinor: string;
  version: number;
};

type Agreement = {
  id: string;
  status: string;
  title: string;
  agreementType: string;
  quoteId: string;
  opportunityId: string | null;
  executedVersionId: string | null;
};

type Plan = {
  id: string;
  sourceKind: string;
  sourceId: string;
  sourceNumber: string | null;
  currency: string;
  expectedTotalMinor: string;
  scheduledTotalMinor: string;
  status: string;
};

type Project = {
  id: string;
  opportunityId: string;
  number: string | null;
  name: string;
  status: string;
  preparationStatus: string;
  templateVersionId: string | null;
  currentPlanVersionId: string | null;
};

type Template = {
  id: string;
  name: string;
  status: string;
  commercialModels: string[];
};

type OpportunityHubProps = {
  tenantSlug: string;
  opportunityId: string;
  opportunity: {
    state: string;
    currency: string;
    estimatedValueMinor: number;
    version: number;
  };
};

export function OpportunityJourney({
  tenantSlug,
  opportunityId,
  opportunity,
}: OpportunityHubProps) {
  const base = `/api/tenants/${tenantSlug}`;
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [agreementPublicLink, setAgreementPublicLink] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [createQuoteOpen, setCreateQuoteOpen] = useState(false);
  const [createAgreementOpen, setCreateAgreementOpen] = useState(false);

  const quoteLines = [
    {
      description: "",
      quantity: "1",
      unitPriceMajor: "",
      discountPercent: "0",
      taxRateBps: "0",
    },
  ];
  const [lines, setLines] = useState(quoteLines);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setMessage(null);
      try {
        await action();
        await load();
        setMessage({ kind: "ok", text: "Acción completada." });
      } catch (error) {
        setMessage({
          kind: "error",
          text:
            error instanceof Error ? error.message : "No se pudo completar la acción.",
        });
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function load() {
    const [quoteRows, agreementRows, planRows, projectRows, templateRows] =
      await Promise.all([
        fetch(`${base}/quotes`, { cache: "no-store" }),
        fetch(`${base}/agreements`, { cache: "no-store" }),
        fetch(`${base}/payments/plans`, { cache: "no-store" }),
        fetch(`${base}/projects`, { cache: "no-store" }),
        fetch(`${base}/project-templates`, { cache: "no-store" }),
      ]);
    const [quotesData, agreementsData, plansData, projectsData, templatesData] =
      await Promise.all([
        quoteRows.json(),
        agreementRows.json(),
        planRows.json(),
        projectRows.json(),
        templateRows.json(),
      ]);
    setQuotes(
      (quotesData as Quote[]).filter((quote) => quote.opportunityId === opportunityId),
    );
    const quoteIds = new Set(
      (quotesData as Quote[])
        .filter((q) => q.opportunityId === opportunityId)
        .map((q) => q.id),
    );
    setAgreements(
      (agreementsData as Agreement[]).filter(
        (agreement) =>
          agreement.opportunityId === opportunityId || quoteIds.has(agreement.quoteId),
      ),
    );
    const agreementIds = new Set(
      (agreementsData as Agreement[])
        .filter((a) => a.opportunityId === opportunityId || quoteIds.has(a.quoteId))
        .map((a) => a.id),
    );
    setPlans(
      (plansData as { plans: Plan[] }).plans.filter(
        (plan) => quoteIds.has(plan.sourceId) || agreementIds.has(plan.sourceId),
      ),
    );
    setProjects(
      (projectsData as { projects: Project[] }).projects.filter(
        (project) => project.opportunityId === opportunityId,
      ),
    );
    setTemplates(
      (templatesData as { templates: Template[] }).templates.filter(
        (template) => template.status === "published",
      ),
    );
  }

  useEffect(() => {
    void load().catch(() =>
      setMessage({ kind: "error", text: "No se pudo cargar el estado del flujo." }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptedQuote = quotes.find((quote) => quote.status === "accepted");
  const executedAgreement = agreements.find(
    (agreement) => agreement.status === "executed",
  );
  const draftQuote = quotes[0];
  const linkedQuote = quotes.find(
    (quote) => quote.status === "issued" || quote.status === "viewed",
  );
  const project = projects[0];
  const plan = plans[0];

  async function createQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await postApi(`${base}/quotes`, {
      title: data.get("title"),
      currency: data.get("currency"),
      opportunityId,
      accountId: data.get("accountId") ? String(data.get("accountId")) : null,
      contactId: data.get("contactId") ? String(data.get("contactId")) : null,
      expiresAt: data.get("expiresAt")
        ? new Date(String(data.get("expiresAt"))).toISOString()
        : null,
      lines: lines.map((line) => ({
        description: line.description,
        quantity: line.quantity || "1",
        unitPriceMinor: String(Math.round(Number(line.unitPriceMajor || 0) * 100)),
        discount: {
          type: "percent",
          value: String(Math.round(Number(line.discountPercent || 0) * 100)),
        },
        taxRateBps: line.taxRateBps || "0",
      })),
    });
    if (!response.ok) throw new Error(await readError(response));
    setCreateQuoteOpen(false);
    setLines([
      {
        description: "",
        quantity: "1",
        unitPriceMajor: "",
        discountPercent: "0",
        taxRateBps: "0",
      },
    ]);
  }

  async function closeWon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await postApi(
      `${base}/sales/opportunities/${opportunityId}/transition`,
      {
        version: opportunity.version,
        state: "won",
        finalValueMinor: Number(data.get("finalValue")),
      },
    );
    if (!response.ok) throw new Error(await readError(response));
  }

  async function createAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await postApi(`${base}/agreements`, {
      title: data.get("title"),
      agreementType: "fixed_project_service_agreement",
      quoteId: acceptedQuote!.id,
      provider: {
        name: data.get("providerName"),
        email: data.get("providerEmail"),
        role: data.get("providerRole") || "Proveedor",
      },
      customer: {
        name: data.get("customerName"),
        email: data.get("customerEmail"),
        role: data.get("customerRole") || "Cliente",
      },
    });
    if (!response.ok) throw new Error(await readError(response));
    setCreateAgreementOpen(false);
  }

  async function issueQuote(quoteId: string) {
    const response = await postApi(`${base}/quotes/${quoteId}/issue`);
    if (!response.ok) throw new Error(await readError(response));
  }

  async function createPublicLink(quoteId: string) {
    const response = await postApi(`${base}/quotes/${quoteId}/public-link`, {
      expiresAt: null,
    });
    if (!response.ok) throw new Error(await readError(response));
    const { token } = (await response.json()) as { token: string };
    setPublicLink(`${window.location.origin}/q#t=${encodeURIComponent(token)}`);
  }

  async function issueAgreement(agreementId: string) {
    const response = await postApi(`${base}/agreements/${agreementId}/issue`, {
      method: "internal_electronic_acceptance",
      signingOrder: "provider_first",
    });
    if (!response.ok) throw new Error(await readError(response));
    const data = (await response.json()) as { agreement: { publicTokens: string[] } };
    const token = data.agreement.publicTokens[0];
    if (token) {
      setAgreementPublicLink(
        `${window.location.origin}/a#t=${encodeURIComponent(token)}`,
      );
    }
  }

  async function acceptInternally(
    event: FormEvent<HTMLFormElement>,
    agreementId: string,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await postApi(
      `${base}/agreements/${agreementId}/internal-accept`,
      {
        fullName: data.get("fullName"),
        idempotencyKey: crypto.randomUUID(),
      },
    );
    if (!response.ok) throw new Error(await readError(response));
    setApprovalId(null);
  }

  async function createPlan() {
    const source = executedAgreement ? executedAgreement : acceptedQuote;
    if (!source)
      throw new Error("Hace falta una cotización aceptada o un contrato ejecutado.");
    const response = await postApi(`${base}/payments/plans`, {
      sourceKind: executedAgreement ? "executed_agreement" : "accepted_quote",
      sourceId: source.id,
    });
    if (!response.ok) throw new Error(await readError(response));
  }

  async function openPlan(planId: string) {
    const response = await postApi(`${base}/payments/plans/${planId}`);
    if (!response.ok) throw new Error(await readError(response));
  }

  async function submitManualPayment(
    event: FormEvent<HTMLFormElement>,
    planId: string,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await postApi(`${base}/payments/manual`, {
      planId,
      amountMinor: String(Math.round(Number(data.get("amount")) * 100)),
      currency: opportunity.currency,
      paidAt: new Date().toISOString(),
      method: "manual_transfer",
      idempotencyKey: crypto.randomUUID(),
      note: data.get("note") ? String(data.get("note")) : undefined,
    });
    if (!response.ok) throw new Error(await readError(response));
  }

  async function selectTemplate(templateId: string) {
    const response = await postApi(`${base}/projects/${project?.id}`, {
      action: "select_template",
      templateId,
    });
    if (!response.ok) throw new Error(await readError(response));
  }

  async function requestActivation() {
    const response = await postApi(`${base}/projects/${project?.id}`, {
      action: "request_activation",
      idempotencyKey: crypto.randomUUID(),
    });
    if (!response.ok) throw new Error(await readError(response));
    const result = (await response.json()) as {
      approval?: { id?: string };
    };
    setApprovalId(result.approval?.id ?? null);
  }

  async function decideApproval(decision: "approved" | "rejected") {
    if (!approvalId) throw new Error("No hay aprobación pendiente.");
    const response = await postApi(`${base}/projects/${project?.id}`, {
      action: "decide_approval",
      approvalId,
      decision,
      reason: decision === "rejected" ? "Ajustes requeridos" : undefined,
    });
    if (!response.ok) throw new Error(await readError(response));
    setApprovalId(null);
  }

  async function activateProject() {
    const response = await postApi(`${base}/projects/${project?.id}`, {
      action: "activate",
    });
    if (!response.ok) throw new Error(await readError(response));
  }

  const stepBtn =
    "rounded bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
  const ghostBtn =
    "rounded border border-[var(--crm-border)] px-4 py-2 text-sm disabled:opacity-50";
  const inputCls =
    "mt-1 block w-full rounded border border-[var(--crm-border)] p-2 text-sm";

  return (
    <div className="mt-8 grid gap-6">
      {message ? (
        <p
          className={`rounded border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      <section className="rounded-lg border p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">1. Cotización</h2>
            {draftQuote ? (
              <p className="mt-1 text-sm text-[var(--crm-muted)]">
                {draftQuote.number ?? "Borrador"} · {draftQuote.title} ·{" "}
                {quoteStatusLabels[draftQuote.status] ?? draftQuote.status}
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--crm-muted)]">
                Aún no hay cotización para esta oportunidad.
              </p>
            )}
          </div>
          <button
            className={stepBtn}
            disabled={busy}
            onClick={() => setCreateQuoteOpen((open) => !open)}
            type="button"
          >
            {createQuoteOpen ? "Cerrar" : "Nueva cotización"}
          </button>
        </div>
        {createQuoteOpen ? (
          <form
            className="mt-4 grid max-w-3xl gap-3"
            onSubmit={(event) => void run(() => createQuote(event))}
          >
            <label className="grid gap-1 text-sm">
              Título
              <input className={inputCls} name="title" required />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-sm">
                Moneda
                <input
                  className={inputCls}
                  defaultValue={opportunity.currency}
                  maxLength={3}
                  name="currency"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm">
                Vence
                <input className={inputCls} name="expiresAt" type="date" />
              </label>
              <label className="grid gap-1 text-sm">
                Cuenta ID
                <input className={inputCls} name="accountId" />
              </label>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Líneas</p>
              {lines.map((line, index) => (
                <div
                  className="grid gap-2 rounded border p-3 sm:grid-cols-[2fr_90px_130px_130px_90px]"
                  key={index}
                >
                  <label className="grid gap-1 text-sm">
                    Descripción
                    <input
                      className={inputCls}
                      value={line.description}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = {
                          ...next[index],
                          description: event.target.value,
                        };
                        setLines(next);
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Cantidad
                    <input
                      className={inputCls}
                      value={line.quantity}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = { ...next[index], quantity: event.target.value };
                        setLines(next);
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Precio unitario
                    <input
                      className={inputCls}
                      value={line.unitPriceMajor}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = {
                          ...next[index],
                          unitPriceMajor: event.target.value,
                        };
                        setLines(next);
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Descuento %
                    <input
                      className={inputCls}
                      value={line.discountPercent}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = {
                          ...next[index],
                          discountPercent: event.target.value,
                        };
                        setLines(next);
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    ISR/IVA bps
                    <input
                      className={inputCls}
                      value={line.taxRateBps}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = {
                          ...next[index],
                          taxRateBps: event.target.value,
                        };
                        setLines(next);
                      }}
                    />
                  </label>
                </div>
              ))}
              <button
                className={ghostBtn}
                disabled={busy}
                onClick={() =>
                  setLines((current) => [
                    ...current,
                    {
                      description: "",
                      quantity: "1",
                      unitPriceMajor: "",
                      discountPercent: "0",
                      taxRateBps: "0",
                    },
                  ])
                }
                type="button"
              >
                + Línea
              </button>
            </div>
            <button className={stepBtn} disabled={busy} type="submit">
              Crear cotización
            </button>
          </form>
        ) : null}
        {draftQuote ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {draftQuote.status === "draft" ? (
              <button
                className={stepBtn}
                disabled={busy}
                onClick={() => void run(() => issueQuote(draftQuote.id))}
                type="button"
              >
                Emitir cotización
              </button>
            ) : null}
            {linkedQuote && !acceptedQuote ? (
              <button
                className={ghostBtn}
                disabled={busy}
                onClick={() => void run(() => createPublicLink(linkedQuote.id))}
                type="button"
              >
                Crear enlace público
              </button>
            ) : null}
          </div>
        ) : null}
        {linkedQuote ? (
          <p className="mt-3 text-sm text-[var(--crm-muted)]">
            Enlace de cotización:{" "}
            <a
              className="text-[var(--crm-primary)] underline"
              href={`/q`}
              target="_blank"
              rel="noreferrer"
            >
              /q
            </a>
          </p>
        ) : null}
        {publicLink ? (
          <p className="mt-2 break-all rounded border bg-[var(--crm-background)] p-3 text-sm">
            <strong>Enlace público con token:</strong>{" "}
            <a className="text-[var(--crm-primary)] underline" href={publicLink}>
              {publicLink}
            </a>
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">2. Cerrar venta</h2>
        <p className="mt-1 text-sm text-[var(--crm-muted)]">
          Estado: {opportunity.state}. Cierra como ganada cuando la cotización esté
          aceptada para crear el proyecto.
        </p>
        {opportunity.state === "open" ? (
          <form
            className="mt-4 flex max-w-xl flex-wrap items-end gap-3"
            onSubmit={(event) => void run(() => closeWon(event))}
          >
            <label className="grid flex-1 gap-1 text-sm">
              Valor final
              <input
                className={inputCls}
                defaultValue={(opportunity.estimatedValueMinor / 100).toString()}
                min="0"
                name="finalValue"
                required
                step="0.01"
                type="number"
              />
            </label>
            <button className={stepBtn} disabled={busy} type="submit">
              Marcar como ganada
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm font-medium">
            Oportunidad {opportunity.state === "won" ? "ganada" : "cerrada"}.
          </p>
        )}
      </section>

      <section className="rounded-lg border p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">3. Contrato</h2>
            {agreements[0] ? (
              <p className="mt-1 text-sm text-[var(--crm-muted)]">
                {agreements[0].title} · {agreements[0].status}
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--crm-muted)]">
                {acceptedQuote
                  ? "Crea el contrato derivado de la cotización aceptada."
                  : "Primero acepta la cotización para poder contratar."}
              </p>
            )}
          </div>
          {acceptedQuote && !agreements[0] ? (
            <button
              className={stepBtn}
              disabled={busy}
              onClick={() => setCreateAgreementOpen((open) => !open)}
              type="button"
            >
              {createAgreementOpen ? "Cerrar" : "Nuevo contrato"}
            </button>
          ) : null}
        </div>
        {createAgreementOpen && acceptedQuote ? (
          <form
            className="mt-4 grid max-w-3xl gap-3 sm:grid-cols-2"
            onSubmit={(event) => void run(() => createAgreement(event))}
          >
            <label className="grid gap-1 text-sm sm:col-span-2">
              Título
              <input className={inputCls} name="title" required />
            </label>
            <p className="text-sm font-medium sm:col-span-2">Proveedor</p>
            <label className="grid gap-1 text-sm">
              Nombre
              <input className={inputCls} name="providerName" required />
            </label>
            <label className="grid gap-1 text-sm">
              Email
              <input className={inputCls} name="providerEmail" required type="email" />
            </label>
            <label className="grid gap-1 text-sm">
              Rol
              <input
                className={inputCls}
                defaultValue="Proveedor"
                name="providerRole"
              />
            </label>
            <p className="text-sm font-medium sm:col-span-2">Cliente</p>
            <label className="grid gap-1 text-sm">
              Nombre
              <input className={inputCls} name="customerName" required />
            </label>
            <label className="grid gap-1 text-sm">
              Email
              <input className={inputCls} name="customerEmail" required type="email" />
            </label>
            <label className="grid gap-1 text-sm">
              Rol
              <input className={inputCls} defaultValue="Cliente" name="customerRole" />
            </label>
            <button
              className={`${stepBtn} sm:col-span-2`}
              disabled={busy}
              type="submit"
            >
              Crear contrato
            </button>
          </form>
        ) : null}
        {agreements[0] ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {agreements[0].status === "ready_to_issue" ? (
              <button
                className={stepBtn}
                disabled={busy}
                onClick={() => void run(() => issueAgreement(agreements[0].id))}
                type="button"
              >
                Emitir contrato
              </button>
            ) : null}
            {["issued", "partially_accepted"].includes(agreements[0].status) ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) =>
                  void run(() => acceptInternally(event, agreements[0].id))
                }
              >
                <label className="grid gap-1 text-sm">
                  Nombre para firmar
                  <input className={`${inputCls} min-w-56`} name="fullName" required />
                </label>
                <button className={ghostBtn} disabled={busy} type="submit">
                  Aceptar internamente
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
        {agreementPublicLink ? (
          <p className="mt-3 break-all rounded border bg-[var(--crm-background)] p-3 text-sm">
            <strong>Enlace público del contrato:</strong>{" "}
            <a
              className="text-[var(--crm-primary)] underline"
              href={agreementPublicLink}
            >
              {agreementPublicLink}
            </a>
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">4. Plan de cobro y pago</h2>
        {plan ? (
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            Plan {plan.sourceNumber ?? plan.id} · {plan.status} ·{" "}
            {(Number(plan.scheduledTotalMinor) / 100).toLocaleString()} {plan.currency}
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            {acceptedQuote || executedAgreement
              ? "Crea el plan de cobro desde el origen comercial."
              : "Hace falta una cotización aceptada o un contrato ejecutado."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {!plan && (acceptedQuote || executedAgreement) ? (
            <button
              className={stepBtn}
              disabled={busy}
              onClick={() => void run(createPlan)}
              type="button"
            >
              Crear plan de cobro
            </button>
          ) : null}
          {plan?.status === "draft" ? (
            <button
              className={ghostBtn}
              disabled={busy}
              onClick={() => void run(() => openPlan(plan.id))}
              type="button"
            >
              Abrir plan
            </button>
          ) : null}
          {plan?.status === "open" ? (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => void run(() => submitManualPayment(event, plan.id))}
            >
              <label className="grid gap-1 text-sm">
                Monto ({opportunity.currency})
                <input
                  className={`${inputCls} min-w-40`}
                  min="0"
                  name="amount"
                  required
                  step="0.01"
                  type="number"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Referencia
                <input className={`${inputCls} min-w-40`} name="note" />
              </label>
              <button className={ghostBtn} disabled={busy} type="submit">
                Registrar pago manual
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">5. Proyecto</h2>
        {project ? (
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            {project.number ?? "Borrador"} · {project.name} · {project.status} ·{" "}
            {project.preparationStatus}
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            {opportunity.state === "won"
              ? "El proyecto se crea al procesar el evento de venta ganada (worker de integraciones)."
              : "El borrador aparece al ganar la oportunidad."}
          </p>
        )}
        {project?.status === "draft" &&
        !project.templateVersionId &&
        templates.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                className={ghostBtn}
                disabled={busy}
                key={template.id}
                onClick={() => void run(() => selectTemplate(template.id))}
                type="button"
              >
                Usar plantilla: {template.name}
              </button>
            ))}
          </div>
        ) : null}
        {project?.status === "draft" && project.templateVersionId ? (
          <button
            className={`${stepBtn} mt-4`}
            disabled={busy}
            onClick={() => void run(requestActivation)}
            type="button"
          >
            Solicitar activación
          </button>
        ) : null}
        {approvalId ? (
          <div className="mt-4 flex gap-2">
            <button
              className={stepBtn}
              disabled={busy}
              onClick={() => void run(() => decideApproval("approved"))}
              type="button"
            >
              Aprobar
            </button>
            <button
              className={ghostBtn}
              disabled={busy}
              onClick={() => void run(() => decideApproval("rejected"))}
              type="button"
            >
              Rechazar
            </button>
          </div>
        ) : null}
        {project?.status === "activation_pending" ? (
          <button
            className={`${stepBtn} mt-4`}
            disabled={busy}
            onClick={() => void run(activateProject)}
            type="button"
          >
            Activar proyecto
          </button>
        ) : null}
      </section>
    </div>
  );
}
