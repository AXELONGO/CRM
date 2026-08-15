export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeSearchText(value: string): string {
  return normalizeDisplayName(value).toLocaleLowerCase("und");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function normalizePhone(value: string, countryCode?: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (digits.length < 8 || digits.length > 15) throw new Error("PHONE_INVALID");
    return `+${digits}`;
  }
  if (!countryCode || !/^\+[1-9]\d{0,2}$/.test(countryCode)) {
    throw new Error("PHONE_COUNTRY_REQUIRED");
  }
  const normalized = `${countryCode}${digits}`;
  if (normalized.length < 9 || normalized.length > 16) throw new Error("PHONE_INVALID");
  return normalized;
}

export function normalizeContactMethod(
  type: "email" | "phone" | "whatsapp",
  value: string,
  countryCode?: string,
): string {
  if (type === "email") return normalizeEmail(value);
  return normalizePhone(value, countryCode);
}

export function maskContactValue(value: string): string {
  if (value.includes("@")) {
    const [local, domain] = value.split("@", 2);
    return `${local.slice(0, 2)}***@${domain}`;
  }
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

export function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

export function decodeCursor(value: string): { updatedAt: Date; id: string } {
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  const [date, id] = decoded.split("|", 2);
  const updatedAt = new Date(date);
  if (!id || Number.isNaN(updatedAt.valueOf())) throw new Error("CURSOR_INVALID");
  return { updatedAt, id };
}
