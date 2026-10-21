import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecommendationWidget } from "./RecommendationWidget";
import { DashboardRecommendation } from "@/server/dashboard/types";

describe("RecommendationWidget", () => {
  it("renders general placement guidance and settings link when personalization is disabled", () => {
    const recommendation: DashboardRecommendation = {
      isPersonalized: false,
      category: "general",
      guidance: "Take a 10-minute diagnostic interview to begin calibrating your baseline.",
      lastUpdated: new Date("2026-10-19T10:00:00Z"),
      personalizationStatus: "disabled",
    };

    render(<RecommendationWidget recommendation={recommendation} />);

    expect(screen.getByText("Recommended Next Step")).toBeInTheDocument();
    expect(screen.getByText("General Placement Guidance")).toBeInTheDocument();
    expect(screen.getByText(/Cross-Session Personalization is Off/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText(recommendation.guidance)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /practice now/i })).toBeInTheDocument();
  });

  it("renders calibration progress tracker when consent is active but fewer than 3 post-consent reports exist", () => {
    const recommendation: DashboardRecommendation = {
      isPersonalized: false,
      category: "general",
      guidance: "Continue completing diverse interview simulations.",
      lastUpdated: new Date("2026-10-19T10:00:00Z"),
      personalizationStatus: "insufficient_evidence",
      eligibleReportCount: 2,
      requiredReportCount: 3,
    };

    render(<RecommendationWidget recommendation={recommendation} />);

    expect(screen.getByText("Calibration In Progress")).toBeInTheDocument();
    expect(screen.getByText(/Personalization Active — Calibrating/i)).toBeInTheDocument();
    expect(screen.getByText("2 of 3 completed")).toBeInTheDocument();
    expect(screen.getByText(/We require at least 3 completed simulations post-consent/i)).toBeInTheDocument();
  });

  it("renders full personalized recommendation with evidence grounding and supporting report links", () => {
    const recommendation: DashboardRecommendation = {
      isPersonalized: true,
      category: "personalized",
      guidance: "Personalized recommendation active.",
      lastUpdated: new Date("2026-10-19T10:00:00Z"),
      personalizationStatus: "ready",
      eligibleReportCount: 3,
      requiredReportCount: 3,
      primaryAction: {
        id: "act-1",
        title: "Reinforce Technical Correctness in Full Stack Roles",
        skill: "Technical Correctness",
        dimension: "technical_correctness",
        priority: "high",
        suggestedMode: "technical",
        suggestedDifficulty: "hard",
        suggestedDurationMinutes: 20,
        recommendedFocusAreas: ["Concurrency", "API Architecture"],
        practiceActivity: "Solve complex distributed system challenges under time constraints.",
        suggestedPracticeGoal: "Achieve >= 80 on technical correctness.",
        whySelected: "Identified recurring struggle across 3 recent reports with average score of 68.",
        supportingReportIds: ["rep-uuid-1", "rep-uuid-2", "rep-uuid-3"],
        evidenceExplanation: "Detailed evidence across 3 simulations.",
      },
      secondaryRecommendations: [
        {
          id: "sec-1",
          title: "Refine Communication Conciseness",
          skill: "Communication",
          priority: "medium",
          suggestedMode: "behavioral",
          suggestedDifficulty: "medium",
          practiceActivity: "Practice STAR methodology pacing.",
          suggestedPracticeGoal: "Keep responses under 2 minutes.",
          whySelected: "Pacing was uneven in behavioral sessions.",
          supportingReportIds: ["rep-uuid-1"],
          evidenceExplanation: "Pacing observed in report rep-uuid-1.",
        },
      ],
    };

    render(<RecommendationWidget recommendation={recommendation} />);

    expect(screen.getByText("Personalized Recommendation")).toBeInTheDocument();
    expect(screen.getByText("Reinforce Technical Correctness in Full Stack Roles")).toBeInTheDocument();
    expect(screen.getByText("Concurrency")).toBeInTheDocument();
    expect(screen.getByText("API Architecture")).toBeInTheDocument();
    expect(screen.getByText(/Solve complex distributed system challenges/i)).toBeInTheDocument();
    expect(screen.getByText(/Achieve >= 80 on technical correctness/i)).toBeInTheDocument();
    expect(screen.getByText("technical")).toBeInTheDocument();
    expect(screen.getByText("hard")).toBeInTheDocument();
    expect(screen.getByText("20 min")).toBeInTheDocument();
    expect(screen.getByText(/Identified recurring struggle across 3 recent reports/i)).toBeInTheDocument();

    // Verify report links
    const reportLink = screen.getByRole("link", { name: /report #1/i });
    expect(reportLink).toHaveAttribute("href", "/interview/rep-uuid-1/report");

    // Check secondary recommendations accordion
    expect(screen.getByText("Alternative Practice (1)")).toBeInTheDocument();
    expect(screen.queryByText("Refine Communication Conciseness")).not.toBeInTheDocument();

    // Expand accordion
    fireEvent.click(screen.getByText("Alternative Practice (1)"));
    expect(screen.getByText("Refine Communication Conciseness")).toBeInTheDocument();
    expect(screen.getByText(/Practice STAR methodology pacing/i)).toBeInTheDocument();

    // Practice button has targeted link
    const ctaButton = screen.getByRole("button", { name: /practice recommendation/i });
    expect(ctaButton.closest("a")).toHaveAttribute(
      "href",
      "/start-interview?mode=technical&difficulty=hard&duration=20"
    );
  });
});
