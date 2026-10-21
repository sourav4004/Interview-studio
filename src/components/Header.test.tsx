import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Header } from "./Header";

describe("Header component", () => {
  it("renders the platform branding and phase indicator", () => {
    render(<Header />);
    expect(screen.getByText("AI Interview Simulator")).toBeInTheDocument();
    expect(screen.getByText("Phase 4 · Foundation")).toBeInTheDocument();
  });
});
