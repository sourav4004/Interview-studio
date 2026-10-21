import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatCard } from "./StatCard";
import { Award } from "lucide-react";

describe("StatCard component", () => {
  it("renders title, formatted value, and unit", () => {
    render(
      <StatCard
        title="Recent Score"
        value={85}
        unit="/ 100"
        description="From your most recent report"
        icon={Award}
      />
    );

    expect(screen.getByText("Recent Score")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("/ 100")).toBeInTheDocument();
    expect(
      screen.getByText("From your most recent report")
    ).toBeInTheDocument();
  });

  it("handles null value gracefully with an em-dash rather than fake zero", () => {
    render(
      <StatCard
        title="Average Score"
        value={null}
        description="Requires at least 1 completed interview"
        icon={Award}
      />
    );

    expect(screen.getByText("Average Score")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(
      screen.getByText("Requires at least 1 completed interview")
    ).toBeInTheDocument();
  });
});
