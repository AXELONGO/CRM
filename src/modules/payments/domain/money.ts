export const currencyCode = /^[A-Z]{3}$/;

export function assertMoney(currency: string, amountMinor: bigint): void {
  if (!currencyCode.test(currency) || amountMinor <= BigInt(0))
    throw new Error("PAYMENT_MONEY_INVALID");
}

export function addMoney(left: bigint, right: bigint): bigint {
  if (left < BigInt(0) || right < BigInt(0)) throw new Error("PAYMENT_MONEY_INVALID");
  return left + right;
}
