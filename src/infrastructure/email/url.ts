export function buildAuthEmailUrl(url: string, appBaseUrl: string): string {
  const parsed = new URL(url);
  const allowedOrigin = new URL(appBaseUrl).origin;

  if (parsed.origin !== allowedOrigin) {
    throw new Error("El enlace de autenticacion usa un origen no permitido.");
  }

  return parsed.toString();
}
