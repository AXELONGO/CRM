export function normalizeMessageId(value: string | undefined) {
  return value?.trim().replace(/^<|>$/g, "").toLowerCase() || null;
}
export function chooseEmailThread(
  input: { inReplyTo?: string; references?: string[]; subject?: string },
  known: Array<{ id: string; externalThreadId: string; subject?: string | null }>,
) {
  const ids = [input.inReplyTo, ...(input.references ?? [])]
    .map(normalizeMessageId)
    .filter((value): value is string => Boolean(value));
  const byReference = known.find((conversation) =>
    ids.includes(normalizeMessageId(conversation.externalThreadId) ?? ""),
  );
  if (byReference) return byReference;
  const subject = input.subject
    ?.replace(/^(re|fwd):\s*/gi, "")
    .trim()
    .toLowerCase();
  return subject
    ? (known.find(
        (conversation) => conversation.subject?.trim().toLowerCase() === subject,
      ) ?? null)
    : null;
}
