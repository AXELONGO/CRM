import { requireServerIdentity } from "@/modules/tenancy/infrastructure/server-context";
import { MfaEnrollment } from "./mfa-enrollment";

export const dynamic = "force-dynamic";

export default async function MfaEnrollmentPage() {
  const session = await requireServerIdentity();
  return <MfaEnrollment enabled={Boolean(session.user.twoFactorEnabled)} />;
}
