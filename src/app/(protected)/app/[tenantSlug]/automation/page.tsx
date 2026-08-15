import { requireVerifiedServerSession } from "@/infrastructure/auth/server-session";
import { AutomationRulesClient } from "./rules-client";

export default async function AutomationPage() {
  await requireVerifiedServerSession();
  return <AutomationRulesClient />;
}
