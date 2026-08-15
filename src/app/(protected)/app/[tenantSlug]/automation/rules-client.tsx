"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Rule = {
  id: string;
  name: string;
  module: string;
  status: string;
  priority: number;
};

export function AutomationRulesClient() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/tenants/${tenantSlug}/automation/rules`)
      .then((response) => response.json())
      .then((body) => {
        if (!body.rules) throw new Error(body.error);
        setRules(body.rules);
      })
      .catch((reason: Error) => setError(reason.message));
  }, [tenantSlug]);
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
          Operations / Automation
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
          Rules with receipts
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Versioned rules, explicit actions, and an audit trail. Drafts never execute
          until published.
        </p>
      </header>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-slate-950 p-5 text-white">
          <p className="text-xs uppercase tracking-widest text-slate-400">Live rules</p>
          <p className="mt-4 text-3xl font-semibold">
            {rules.filter((rule) => rule.status === "active").length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-widest text-slate-500">Drafts</p>
          <p className="mt-4 text-3xl font-semibold text-slate-950">
            {rules.filter((rule) => rule.status === "draft").length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-amber-50 p-5">
          <p className="text-xs uppercase tracking-widest text-amber-800">Safety</p>
          <p className="mt-4 text-sm font-medium text-amber-950">
            No dynamic code execution
          </p>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Rule catalog</h2>
        </div>
        {rules.length === 0 ? (
          <p className="p-8 text-sm text-slate-500">
            No hay reglas todavía. Crea la primera desde la API de automatizaciones.
          </p>
        ) : (
          <ul>
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center justify-between border-b border-slate-100 px-5 py-4 last:border-b-0"
              >
                <span className="font-medium text-slate-900">{rule.name}</span>
                <span className="text-xs uppercase tracking-wider text-slate-500">
                  {rule.module} / {rule.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
