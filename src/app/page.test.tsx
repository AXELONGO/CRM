import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("shows the temporary technical status", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "Base tecnica preparada" }),
    ).toBeVisible();
    expect(screen.getByText("Aplicacion: operativa")).toBeVisible();
  });
});
