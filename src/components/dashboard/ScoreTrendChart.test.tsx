import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ScoreTrendChart } from "./ScoreTrendChart";
import { ScoreDataPoint } from "@/server/dashboard/types";

describe("ScoreTrendChart component", () => {
  it("renders empty state when there are no completed reports", () => {
    render(<ScoreTrendChart scoreTrajectory={[]} />);

    expect(
      screen.getByText("No completed sessions for this view")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete your first diagnostic interview to start recording verified scores."
      )
    ).toBeInTheDocument();
  });

  it("renders baseline card when only 1 completed report exists without drawing a synthetic trendline", () => {
    const singlePoint: ScoreDataPoint = {
      interviewId: "int-1",
      role: "Junior React Dev",
      mode: "technical",
      difficulty: "easy",
      completedAt: new Date("2026-10-18T12:00:00Z"),
      overallScore: 78,
      rubricVersion: "1.0",
    };

    render(<ScoreTrendChart scoreTrajectory={[singlePoint]} />);

    expect(screen.getByText("Baseline: Junior React Dev")).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();
    expect(
      screen.getByText(/At least 2 completed sessions in this mode are required/)
    ).toBeInTheDocument();

    // Verify SVG trendline path is not rendered
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders SVG chart and accessible summary when 2+ completed reports exist", () => {
    const multiplePoints: ScoreDataPoint[] = [
      {
        interviewId: "int-1",
        role: "Junior React Dev",
        mode: "technical",
        difficulty: "easy",
        completedAt: new Date("2026-10-10T12:00:00Z"),
        overallScore: 70,
        rubricVersion: "1.0",
      },
      {
        interviewId: "int-2",
        role: "Junior React Dev",
        mode: "technical",
        difficulty: "medium",
        completedAt: new Date("2026-10-18T12:00:00Z"),
        overallScore: 85,
        rubricVersion: "1.0",
      },
    ];

    render(
      <ScoreTrendChart
        scoreTrajectory={multiplePoints}
        trendSummary="Across 2 completed sessions, observed change of +15 points."
      />
    );

    // Chart is rendered with accessibility role
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Across 2 completed sessions, observed change of +15 points."
      )
    ).toBeInTheDocument();
  });

  it("allows switching interview mode tabs", () => {
    const mixedPoints: ScoreDataPoint[] = [
      {
        interviewId: "int-1",
        role: "Software Engineer",
        mode: "technical",
        difficulty: "easy",
        completedAt: new Date("2026-10-10T12:00:00Z"),
        overallScore: 75,
        rubricVersion: "1.0",
      },
      {
        interviewId: "int-2",
        role: "Software Engineer",
        mode: "behavioral",
        difficulty: "medium",
        completedAt: new Date("2026-10-12T12:00:00Z"),
        overallScore: 80,
        rubricVersion: "1.0",
      },
    ];

    render(<ScoreTrendChart scoreTrajectory={mixedPoints} />);

    // Switch to Technical mode tab (only 1 point exists for technical)
    const techTab = screen.getByRole("tab", { name: "Technical" });
    fireEvent.click(techTab);

    // Should now show baseline view for the single technical point
    expect(screen.getByText("Baseline: Software Engineer")).toBeInTheDocument();
  });

  it("does not connect scores from different interview modes into a single line in All Modes view", () => {
    const crossModePoints: ScoreDataPoint[] = [
      {
        interviewId: "int-1",
        role: "Software Engineer",
        mode: "technical",
        difficulty: "easy",
        completedAt: new Date("2026-10-10T12:00:00Z"),
        overallScore: 65,
        rubricVersion: "1.0",
      },
      {
        interviewId: "int-2",
        role: "Product Manager",
        mode: "behavioral",
        difficulty: "medium",
        completedAt: new Date("2026-10-12T12:00:00Z"),
        overallScore: 85,
        rubricVersion: "1.0",
      },
    ];

    const { container } = render(<ScoreTrendChart scoreTrajectory={crossModePoints} />);

    // Chart is rendered with SVG
    expect(screen.getByRole("img")).toBeInTheDocument();

    // Mode series legend is displayed
    expect(screen.getByText("Mode Series:")).toBeInTheDocument();

    // No stroke path connecting the cross-mode points should exist since each mode has only 1 point (< 2)
    const paths = container.querySelectorAll("svg path[stroke]");
    expect(paths.length).toBe(0);
  });

  it("renders separate series for each mode when modes have sufficient data", () => {
    const multiSeriesPoints: ScoreDataPoint[] = [
      {
        interviewId: "tech-1",
        role: "Dev",
        mode: "technical",
        difficulty: "easy",
        completedAt: new Date("2026-10-10T12:00:00Z"),
        overallScore: 70,
        rubricVersion: "1.0",
      },
      {
        interviewId: "beh-1",
        role: "Dev",
        mode: "behavioral",
        difficulty: "easy",
        completedAt: new Date("2026-10-11T12:00:00Z"),
        overallScore: 80,
        rubricVersion: "1.0",
      },
      {
        interviewId: "tech-2",
        role: "Dev",
        mode: "technical",
        difficulty: "medium",
        completedAt: new Date("2026-10-12T12:00:00Z"),
        overallScore: 75,
        rubricVersion: "1.0",
      },
      {
        interviewId: "beh-2",
        role: "Dev",
        mode: "behavioral",
        difficulty: "medium",
        completedAt: new Date("2026-10-13T12:00:00Z"),
        overallScore: 85,
        rubricVersion: "1.0",
      },
    ];

    const { container } = render(<ScoreTrendChart scoreTrajectory={multiSeriesPoints} />);

    // Should render 2 separate paths: 1 technical (stroke #4F46E5) and 1 behavioral (stroke #8B5CF6)
    const paths = container.querySelectorAll("svg path[stroke]");
    expect(paths.length).toBe(2);

    const technicalPath = container.querySelector('svg path[stroke="#4F46E5"]');
    const behavioralPath = container.querySelector('svg path[stroke="#8B5CF6"]');

    expect(technicalPath).not.toBeNull();
    expect(behavioralPath).not.toBeNull();
  });

  it("does not connect points across incompatible rubric versions", () => {
    const mixedRubricPoints: ScoreDataPoint[] = [
      {
        interviewId: "int-1",
        role: "Dev",
        mode: "technical",
        difficulty: "easy",
        completedAt: new Date("2026-10-10T12:00:00Z"),
        overallScore: 70,
        rubricVersion: "1.0",
      },
      {
        interviewId: "int-2",
        role: "Dev",
        mode: "technical",
        difficulty: "medium",
        completedAt: new Date("2026-10-18T12:00:00Z"),
        overallScore: 85,
        rubricVersion: "2.0", // Rubric version changed
      },
    ];

    const { container } = render(<ScoreTrendChart scoreTrajectory={mixedRubricPoints} />);

    // Because rubric versions differ between point 1 and 2, no connecting line should be drawn across the rubric boundary
    const paths = container.querySelectorAll("svg path[stroke]");
    expect(paths.length).toBe(0);
  });
});
