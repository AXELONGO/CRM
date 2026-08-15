"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";

type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: { id: string; name: string; color: string }[];
};
type Board = {
  stages: {
    id: string;
    name: string;
    color: string;
    opportunities: {
      id: string;
      title: string;
      currency: string;
      estimatedValueMinor: number;
      state: string;
      ownerMembershipId: string;
      nextActivity: { title: string; scheduledAt: Date | null } | null;
    }[];
  }[];
} | null;

export function SalesBoard({
  tenantSlug,
  pipelines,
  selectedPipelineId,
  board,
  membershipId,
}: {
  tenantSlug: string;
  pipelines: Pipeline[];
  selectedPipelineId?: string;
  board: Board;
  membershipId: string;
}) {
  const [message, setMessage] = useState("");
  const selected =
    pipelines.find((pipeline) => pipeline.id === selectedPipelineId) ??
    pipelines.find((pipeline) => pipeline.isDefault) ??
    pipelines[0];

  async function createOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/tenants/${tenantSlug}/sales/opportunities`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: data.get("title"),
        pipelineId: selected.id,
        ownerMembershipId: membershipId,
        accountId: data.get("accountId") || null,
        primaryContactId: data.get("primaryContactId") || null,
        pricingModel: "fixed_price",
        currency: data.get("currency"),
        estimatedValueMinor: Number(data.get("value")) * 100,
      }),
    });
    setMessage(
      response.ok
        ? "Oportunidad creada. Recarga para verla."
        : "No se pudo crear la oportunidad.",
    );
  }

  return (
    <div className="mt-8">
      <nav aria-label="Pipelines" className="flex flex-wrap gap-2 border-b pb-4">
        {pipelines.map((pipeline) => (
          <Link
            className={`rounded-full border px-3 py-1 text-sm ${pipeline.id === selected.id ? "bg-slate-900 text-white" : ""}`}
            href={`/app/${tenantSlug}/sales?pipeline=${pipeline.id}`}
            key={pipeline.id}
          >
            {pipeline.name}
          </Link>
        ))}
      </nav>
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        {board?.stages.map((stage) => (
          <section
            aria-labelledby={`stage-${stage.id}`}
            className="min-h-48 rounded-lg bg-slate-50 p-3"
            key={stage.id}
          >
            <h2 className="font-semibold" id={`stage-${stage.id}`}>
              {stage.name}
              <span className="ml-2 text-xs text-slate-500">
                {stage.opportunities.length}
              </span>
            </h2>
            <div className="mt-3 grid gap-2">
              {stage.opportunities.map((opportunity) => (
                <Link
                  className="rounded border bg-white p-3 shadow-sm hover:border-slate-500"
                  href={`/app/${tenantSlug}/sales/opportunities/${opportunity.id}`}
                  key={opportunity.id}
                >
                  <strong className="block text-sm">{opportunity.title}</strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    {opportunity.currency}{" "}
                    {(opportunity.estimatedValueMinor / 100).toLocaleString()}
                  </span>
                  {opportunity.nextActivity ? (
                    <span className="mt-2 block text-xs text-amber-700">
                      {opportunity.nextActivity.title}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <details className="mt-8 rounded border p-4">
        <summary className="cursor-pointer font-medium">Nueva oportunidad</summary>
        <form
          className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2"
          onSubmit={createOpportunity}
        >
          <label className="grid gap-1 text-sm sm:col-span-2">
            Título
            <input className="rounded border p-2" name="title" required />
          </label>
          <label className="grid gap-1 text-sm">
            Cuenta ID
            <input className="rounded border p-2" name="accountId" />
          </label>
          <label className="grid gap-1 text-sm">
            Contacto ID
            <input className="rounded border p-2" name="primaryContactId" />
          </label>
          <label className="grid gap-1 text-sm">
            Valor
            <input
              className="rounded border p-2"
              min="0"
              name="value"
              required
              type="number"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Moneda
            <input
              className="rounded border p-2"
              defaultValue="MXN"
              maxLength={3}
              name="currency"
              required
            />
          </label>
          <button
            className="rounded bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-white sm:col-span-2"
            type="submit"
          >
            Crear oportunidad
          </button>
        </form>
        {message ? (
          <p className="mt-3 text-sm" role="status">
            {message}
          </p>
        ) : null}
      </details>
    </div>
  );
}
