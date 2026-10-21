import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DimensionComparison } from "./DimensionComparison";
import { DimensionAggregate } from "@/server/dashboard/types";

describe("DimensionComparison component", () => {
  const mockDimensions: DimensionAggregate[] = [
    {
      dimension: "technical_correctness",
      label: "Technical Correctness",
      averageScore: 88,
      scoredCount: 2,
      trend: [
        {
          interviewId: "int-1",
          completedAt: new Date(),
          score: 85,
          status: "scored",
        },
        {
          interviewId: "int-2",
          completedAt: new Date(),
          score: 91,
          status: "scored",
        },
      ],
    },
    {
      dimension: "resume_consistency",
      label: "Resume Consistency",
      averageScore: null,
      scoredCount: 0,
      trend: [
        {
          interviewId: "int-1",
          completedAt: new Date(),
          score: null,
          status: "not_applicable",
        },
      ],
    },
    {
      dimension: "communication_speech",
      label: "Communication Clarity",
      averageScore: null,
      scoredCount: 0,
      trend: [
        {
          interviewId: "int-1",
          completedAt: new Date(),
          score: null,
          status: "insufficient_evidence",
        },
      ],
    },
  ];

  it("renders scored dimensions with average score out of 100", () => {
    render(<DimensionComparison dimensions={mockDimensions} />);

    expect(screen.getByText("Technical Correctness")).toBeInTheDocument();
    expect(screen.getByText("88 / 100")).toBeInTheDocument();
    expect(screen.getByText("(2 sessions)")).toBeInTheDocument();
  });

  it("renders 'Not Evaluated' without penalizing non-applicable dimensions as 0", () => {
    render(<DimensionComparison dimensions={mockDimensions} />);

    expect(screen.getByText("Resume Consistency")).toBeInTheDocument();
    expect(screen.getByText("Not Evaluated")).toBeInTheDocument();
    // Ensure "0 / 100" is never rendered
    expect(screen.queryByText("0 / 100")).toBeNull();
  });

  it("renders 'Insufficient Evidence' for dimensions lacking enough signal", () => {
    render(<DimensionComparison dimensions={mockDimensions} />);

    expect(screen.getByText("Communication Clarity")).toBeInTheDocument();
    expect(screen.getByText("Insufficient Evidence")).toBeInTheDocument();
    // Ensure "0 / 100" is not rendered
    expect(screen.queryByText("0 / 100")).toBeNull();
  });
});
