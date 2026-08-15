import { getVerifiedServerSession } from "@/infrastructure/auth/server-session";
import { InviteClient } from "./invite-client";

export const dynamic = "force-dynamic";
export const metadata = { referrer: "no-referrer" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getVerifiedServerSession();
  return <InviteClient token={token} email={session?.user.email ?? null} />;
}
