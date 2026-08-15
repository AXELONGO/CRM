import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { getEnvironment } from "@/infrastructure/config/env";

function blockedIp(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

export async function validateIntegrationUrl(
  raw: string,
  options?: { allowedPorts?: number[] },
) {
  const environment = getEnvironment();
  const url = new URL(raw);
  if (
    url.protocol !== "https:" &&
    !(
      environment.NODE_ENV !== "production" &&
      environment.ALLOW_LOCAL_INTEGRATION_HOSTS &&
      url.protocol === "http:"
    )
  )
    throw new Error("INTEGRATION_TLS_REQUIRED");
  if (url.username || url.password)
    throw new Error("INTEGRATION_URL_CREDENTIALS_FORBIDDEN");
  if (
    options?.allowedPorts &&
    !options.allowedPorts.includes(
      Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    )
  )
    throw new Error("INTEGRATION_PORT_FORBIDDEN");
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true });
  if (
    !environment.ALLOW_LOCAL_INTEGRATION_HOSTS &&
    addresses.some(({ address }) => blockedIp(address))
  )
    throw new Error("INTEGRATION_PRIVATE_ADDRESS_FORBIDDEN");
  return url;
}
