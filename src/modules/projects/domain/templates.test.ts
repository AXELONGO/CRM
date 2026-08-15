import { describe, expect, it } from "vitest";
import {
  evaluateTemplateRules,
  normalizeTemplateContent,
  templateContentHash,
} from "./templates";

const content = {
  phases: [{ key: "start", name: "Inicio", order: 1 }],
  tasks: [{ key: "brief", phaseKey: "start", title: "Preparar brief" }],
};

describe("project templates", () => {
  it("normalizes and hashes valid content", () => {
    expect(templateContentHash(content)).toHaveLength(64);
    expect(normalizeTemplateContent(content).tasks[0].key).toBe("brief");
  });
  it("rejects dependency cycles", () => {
    expect(() =>
      normalizeTemplateContent({
        ...content,
        tasks: [
          { key: "a", phaseKey: "start", title: "A", dependencyKeys: ["b"] },
          { key: "b", phaseKey: "start", title: "B", dependencyKeys: ["a"] },
        ],
      }),
    ).toThrow("PROJECT_TEMPLATE_DEPENDENCY_CYCLE");
  });
  it("does not guess an ambiguous rule", () => {
    expect(
      evaluateTemplateRules(
        [
          { priority: 10, enabled: true, commercialModel: "fixed", templateId: "a" },
          { priority: 10, enabled: true, commercialModel: "fixed", templateId: "b" },
        ],
        "fixed",
      ).status,
    ).toBe("ambiguous");
  });
});
