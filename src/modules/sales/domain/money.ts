export const currencyCode = /^[A-Z]{3}$/;

export type Money = { currency: string; minor: bigint };

export function parseMinor(value: string | number | bigint): bigint {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0))
    throw new Error("MONEY_INVALID");
  if (typeof value === "string" && !/^\d+$/.test(value))
    throw new Error("MONEY_INVALID");
  const minor = BigInt(value);
  if (minor < BigInt(0)) throw new Error("MONEY_INVALID");
  return minor;
}

export function toSafeMinorNumber(value: bigint): number {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue) || BigInt(numberValue) !== value)
    throw new Error("MONEY_INVALID");
  return numberValue;
}

export function makeMoney(currency: string, minor: string | number | bigint): Money {
  if (!currencyCode.test(currency)) throw new Error("MONEY_INVALID");
  return { currency, minor: parseMinor(minor) };
}

export function weightedMinor(
  value: string | number | bigint,
  probability: number,
): number {
  if (!Number.isInteger(probability) || probability < 0 || probability > 100)
    throw new Error("FORECAST_INVALID");
  return toSafeMinorNumber(
    (parseMinor(value) * BigInt(probability) + BigInt(50)) / BigInt(100),
  );
}
