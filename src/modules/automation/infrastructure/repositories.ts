import { desc, eq } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import {
  automationRuleVersions,
  automationRules,
} from "@/infrastructure/database/schema";
import { validateAutomationDefinition } from "../domain/engine";

export async function listAutomationRules(tx: TenantTransaction, tenantId: string) {
  return tx
    .select()
    .from(automationRules)
    .where(eq(automationRules.tenantId, tenantId))
    .orderBy(desc(automationRules.priority));
}

export async function createAutomationRule(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    id: string;
    versionId: string;
    name: string;
    description?: string;
    module: string;
    triggerName: string;
    definition: unknown;
    summary: string;
    definitionHash: string;
    userId: string;
  },
) {
  const definition = validateAutomationDefinition(input.definition);
  const [rule] = await tx
    .insert(automationRules)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      name: input.name,
      description: input.description,
      module: input.module,
      status: "draft",
      createdByUserId: input.userId,
      updatedByUserId: input.userId,
    })
    .returning();
  await tx.insert(automationRuleVersions).values({
    id: input.versionId,
    tenantId: input.tenantId,
    ruleId: input.id,
    versionNumber: 1,
    triggerName: input.triggerName,
    definition,
    summary: input.summary,
    definitionHash: input.definitionHash,
    schemaVersion: 1,
    publishedByUserId: input.userId,
  });
  return rule;
}
