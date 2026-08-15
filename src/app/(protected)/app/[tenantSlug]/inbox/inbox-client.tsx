"use client";
import { useState } from "react";
type Conversation = {
  id: string;
  channel: string;
  externalThreadId: string;
  status: string;
  priority: string;
  contactId: string | null;
  assignedMembershipId: string | null;
  updatedAt: Date;
};
export function InboxClient({
  tenantSlug,
  initialConversations,
}: {
  tenantSlug: string;
  initialConversations: Conversation[];
}) {
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [detail, setDetail] = useState<{
    messages: Array<{
      id: string;
      direction: string;
      kind: string;
      bodyText: string | null;
      status: string;
    }>;
    notes: Array<{ id: string; bodyText: string }>;
  } | null>(null);
  async function open(conversation: Conversation) {
    setSelected(conversation);
    const response = await fetch(
      `/api/tenants/${tenantSlug}/inbox/conversations/${conversation.id}`,
    );
    if (response.ok) setDetail(await response.json());
  }
  return (
    <div className="mt-8 grid min-h-[520px] gap-4 md:grid-cols-[minmax(260px,360px)_1fr]">
      <aside className="rounded border" aria-label="Conversaciones">
        <div className="border-b p-3 text-sm font-medium">
          Conversaciones ({initialConversations.length})
        </div>
        {initialConversations.map((conversation) => (
          <button
            className={`block w-full border-b p-4 text-left text-sm ${selected?.id === conversation.id ? "bg-slate-100" : ""}`}
            key={conversation.id}
            onClick={() => void open(conversation)}
            type="button"
          >
            <span className="font-medium">{conversation.channel}</span>
            <span className="mt-1 block text-slate-500">
              {conversation.externalThreadId}
            </span>
            <span className="mt-1 block text-xs">{conversation.status}</span>
          </button>
        ))}
        {!initialConversations.length ? (
          <p className="p-4 text-sm text-[var(--crm-muted)]">No hay conversaciones.</p>
        ) : null}
      </aside>
      <section aria-live="polite" className="rounded border p-5">
        {selected && detail ? (
          <>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="font-semibold">{selected.channel}</h2>
                <p className="text-sm text-slate-500">{selected.externalThreadId}</p>
              </div>
              <span className="rounded-full border px-3 py-1 text-xs">
                {selected.status}
              </span>
            </div>
            <div className="mt-6 grid gap-3">
              {detail.messages.map((message) => (
                <article
                  className={`max-w-[85%] rounded p-3 text-sm ${message.direction === "outbound" ? "ml-auto bg-slate-900 text-white" : "bg-slate-100"}`}
                  key={message.id}
                >
                  <p>{message.bodyText ?? `[${message.kind}]`}</p>
                  <span className="mt-1 block text-xs opacity-70">
                    {message.status}
                  </span>
                </article>
              ))}
            </div>
            <h3 className="mt-8 font-medium">Notas internas</h3>
            {detail.notes.map((note) => (
              <p className="mt-2 rounded bg-amber-50 p-3 text-sm" key={note.id}>
                {note.bodyText}
              </p>
            ))}
          </>
        ) : (
          <p className="text-sm text-[var(--crm-muted)]">
            Selecciona una conversación.
          </p>
        )}
      </section>
    </div>
  );
}
