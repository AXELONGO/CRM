import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-8 shadow-sm sm:p-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">
          CRM
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Base tecnica preparada
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--crm-muted)]">
          La aplicacion web esta funcionando. Los modulos de negocio se incorporaran por
          cortes verticales y con aislamiento multiempresa desde el inicio.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-blue-50 px-4 py-2 font-medium text-blue-800">
            Aplicacion: operativa
          </span>
          <span className="rounded-full bg-slate-100 px-4 py-2 font-medium text-slate-700">
            Modulos CRM: pendientes
          </span>
        </div>
        <Link
          className="mt-8 w-fit rounded-lg bg-[var(--crm-primary)] px-5 py-3 font-medium text-white no-underline hover:opacity-90"
          href="/login"
        >
          Acceder
        </Link>
      </section>
    </main>
  );
}
