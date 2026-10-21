import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import Home from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/"),
}));

describe("Public Landing Page (Guest Access)", () => {
  it("renders public landing page content without requiring authentication", () => {
    render(<Home />);

    // Brand and headline
    expect(screen.getByText("AI Interview Simulator")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Realistic AI Interview Practice for Campus Placements/i,
      })
    ).toBeInTheDocument();


    // Four core interview modes
    expect(screen.getByText("Technical Interview")).toBeInTheDocument();
    expect(screen.getByText("HR & Behavioral")).toBeInTheDocument();
    expect(screen.getByText("Resume-Based")).toBeInTheDocument();
    expect(screen.getByText("Company-Specific")).toBeInTheDocument();

    // Public navigation items
    expect(screen.getByRole("link", { name: "Sign In" })).toBeInTheDocument();
  });
});
