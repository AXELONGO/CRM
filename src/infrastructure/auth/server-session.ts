import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { assertAuthRuntimeConfig, auth } from "./auth";

type SessionLike = { user: { emailVerified: boolean } } | null;

export function isVerifiedSession(
  session: SessionLike,
): session is Exclude<SessionLike, null> {
  return Boolean(session?.user.emailVerified);
}

export async function getVerifiedServerSession() {
  assertAuthRuntimeConfig();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!isVerifiedSession(session)) {
    return null;
  }

  return session;
}

export async function requireVerifiedServerSession() {
  const session = await getVerifiedServerSession();

  if (!session) {
    redirect("/login?next=%2Fapp");
  }

  return session;
}
