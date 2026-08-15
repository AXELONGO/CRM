export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validatePublicOtpConfiguration } =
    await import("@/infrastructure/security/public-otp");
  validatePublicOtpConfiguration();
}
