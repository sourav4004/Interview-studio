"use client";

import React, { useState, useMemo } from "react";
import { ScoreDataPoint } from "@/server/dashboard/types";
import { InterviewMode } from "@/server/ai/types";
import { TrendingUp, AlertCircle, Info, Calendar, Award } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface ScoreTrendChartProps {
  scoreTrajectory: ScoreDataPoint[];
  minimumDataNotice?: string;
  trendSummary?: string;
}

const MODE_CONFIG: Record<
  InterviewMode,
  { stroke: string; fill: string; activeStroke: string; label: string }
> = {
  technical: { stroke: "#4F46E5", fill: "#EEF2FF", activeStroke: "#3730A3", label: "Technical" },
  behavioral: { stroke: "#8B5CF6", fill: "#F5F3FF", activeStroke: "#6D28D9", label: "Behavioral" },
  resume: { stroke: "#0D9488", fill: "#F0FDFA", activeStroke: "#0F766E", label: "Resume" },
  company: { stroke: "#D97706", fill: "#FFFBEB", activeStroke: "#B45309", label: "Company" },
};

export function ScoreTrendChart({
  scoreTrajectory,
  minimumDataNotice,
  trendSummary,
}: ScoreTrendChartProps) {
  const [selectedMode, setSelectedMode] = useState<InterviewMode | "all">("all");
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  // Filter points based on selected mode
  const filteredPoints = useMemo(() => {
    if (selectedMode === "all") return scoreTrajectory;
    return scoreTrajectory.filter((p) => p.mode === selectedMode);
  }, [scoreTrajectory, selectedMode]);

  const count = filteredPoints.length;

  // Chart coordinates calculation (viewBox 0 0 600 240)
  const padding = { top: 20, right: 30, bottom: 40, left: 45 };
  const chartWidth = 600 - padding.left - padding.right;
  const chartHeight = 240 - padding.top - padding.bottom;

  const pointsWithCoords = useMemo(() => {
    if (count < 2) return [];

    return filteredPoints.map((point, index) => {
      const x = padding.left + (index / (count - 1)) * chartWidth;
      // Score is 0-100. Invert Y coordinate since SVG (0,0) is top-left
      const y = padding.top + chartHeight - (point.overallScore / 100) * chartHeight;
      return { ...point, x, y };
    });
  }, [filteredPoints, count, chartWidth, chartHeight, padding.left, padding.top]);

  // Group points into mode-specific series so different modes are NEVER connected on a single line.
  // Within each mode, consecutive points with different rubricVersion are NOT connected to prevent
  // mixing incompatible scoring criteria without notice.
  const modeSeries = useMemo(() => {
    const modes: InterviewMode[] =
      selectedMode === "all"
        ? ["technical", "behavioral", "resume", "company"]
        : [selectedMode];

    return modes
      .map((mode) => {
        const pts = pointsWithCoords.filter((p) => p.mode === mode);
        // Break into segments if rubric version changes
        const segments: (typeof pts)[] = [];
        let currentSeg: typeof pts = [];

        for (const pt of pts) {
          if (currentSeg.length === 0) {
            currentSeg.push(pt);
          } else {
            const prev = currentSeg[currentSeg.length - 1];
            if (prev.rubricVersion === pt.rubricVersion) {
              currentSeg.push(pt);
            } else {
              // Rubric version changed: break segment to prevent misleading trendline across rubric shift
              if (currentSeg.length > 0) {
                segments.push(currentSeg);
              }
              currentSeg = [pt];
            }
          }
        }
        if (currentSeg.length > 0) {
          segments.push(currentSeg);
        }

        const paths = segments
          .filter((seg) => seg.length >= 2)
          .map((seg) =>
            seg.reduce(
              (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
              ""
            )
          );

        return {
          mode,
          points: pts,
          paths,
          config: MODE_CONFIG[mode],
        };
      })
      .filter((s) => s.points.length > 0);
  }, [pointsWithCoords, selectedMode]);

  // Area path for single mode view when rubric version is consistent
  const areaPath = useMemo(() => {
    if (selectedMode === "all" || pointsWithCoords.length < 2) return "";
    const firstPoint = pointsWithCoords[0];
    const consistentRubric = pointsWithCoords.every(
      (p) => p.rubricVersion === firstPoint.rubricVersion
    );
    if (!consistentRubric) return "";

    const linePath = pointsWithCoords.reduce(
      (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
      ""
    );
    const firstX = pointsWithCoords[0].x;
    const lastX = pointsWithCoords[pointsWithCoords.length - 1].x;
    const bottomY = padding.top + chartHeight;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [selectedMode, pointsWithCoords, padding.top, chartHeight]);

  const activePoint =
    activePointIndex !== null && pointsWithCoords[activePointIndex]
      ? pointsWithCoords[activePointIndex]
      : null;

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            <h3 className="text-base font-semibold text-[#171827]">
              Score Trajectory
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological overall scores from completed evaluation reports
          </p>
        </div>

        {/* Mode Selector */}
        <div
          className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-medium self-start sm:self-auto"
          role="tablist"
          aria-label="Filter score trends by interview mode"
        >
          {(
            [
              { key: "all", label: "All Modes" },
              { key: "technical", label: "Technical" },
              { key: "behavioral", label: "Behavioral" },
              { key: "resume", label: "Resume" },
              { key: "company", label: "Company" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selectedMode === tab.key}
              onClick={() => {
                setSelectedMode(tab.key);
                setActivePointIndex(null);
              }}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                selectedMode === tab.key
                  ? "bg-white text-indigo-700 font-semibold shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode Series Legend for All Modes View */}
      {selectedMode === "all" && pointsWithCoords.length >= 2 && (
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 bg-slate-50/80 px-3 py-2 rounded-lg border border-slate-100">
          <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
            Mode Series:
          </span>
          {(["technical", "behavioral", "resume", "company"] as const).map((mode) => (
            <span key={mode} className="flex items-center gap-1.5 capitalize">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: MODE_CONFIG[mode].stroke }}
              />
              {MODE_CONFIG[mode].label}
            </span>
          ))}
        </div>
      )}

      {/* Trajectory Display Content Based on Minimum Data Rules */}
      {count === 0 ? (
        <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            No completed sessions for this view
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {selectedMode === "all"
              ? "Complete your first diagnostic interview to start recording verified scores."
              : `Complete a ${selectedMode} interview to track your score history in this category.`}
          </p>
        </div>
      ) : count === 1 ? (
        <div className="py-6 px-4 border border-indigo-100 bg-indigo-50/40 rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
              {filteredPoints[0].overallScore}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#171827]">
                  Baseline: {filteredPoints[0].role}
                </span>
                <Badge variant="secondary" className="capitalize">
                  {filteredPoints[0].mode}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Completed on{" "}
                {new Date(filteredPoints[0].completedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-indigo-800 bg-white/80 p-2.5 rounded-md border border-indigo-200/60">
            <Info className="h-4 w-4 shrink-0 text-indigo-600" />
            <span>
              At least 2 completed sessions in this mode are required to render an observed trendline. Synthetic curves are never fabricated.
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* SVG Line Chart */}
          <div className="relative w-full overflow-hidden">
            <svg
              viewBox="0 0 600 240"
              className="w-full h-auto overflow-visible select-none"
              role="img"
              aria-label={`Score trajectory chart across ${count} interviews. Scores range from 0 to 100.`}
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y-Axis Labels */}
              {[0, 25, 50, 75, 100].map((score) => {
                const y = padding.top + chartHeight - (score / 100) * chartHeight;
                return (
                  <g key={score} className="text-slate-400">
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={600 - padding.right}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                      strokeDasharray={score === 0 || score === 100 ? "" : "3 3"}
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fill="#64748B"
                      fontFamily="inherit"
                    >
                      {score}
                    </text>
                  </g>
                );
              })}

              {/* Gradient Area Fill Under Line for single-mode views */}
              {areaPath && (
                <path d={areaPath} fill="url(#trendGradient)" />
              )}

              {/* Separate Trend Lines Per Mode (Never connecting cross-mode scores) */}
              {modeSeries.map((series) =>
                series.paths.map((pathStr, pIdx) => (
                  <path
                    key={`${series.mode}-path-${pIdx}`}
                    d={pathStr}
                    fill="none"
                    stroke={series.config.stroke}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))
              )}

              {/* Data Points */}
              {pointsWithCoords.map((pt, idx) => {
                const isSelected = activePointIndex === idx;
                const config = MODE_CONFIG[pt.mode];
                return (
                  <g key={pt.interviewId}>
                    {/* Hit target for accessible hover/touch */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="12"
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setActivePointIndex(idx)}
                      onClick={() => setActivePointIndex(idx)}
                      onFocus={() => setActivePointIndex(idx)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Interview ${idx + 1}: ${pt.role} (${pt.mode}), Score ${pt.overallScore} out of 100 on ${new Date(pt.completedAt).toLocaleDateString()}, Rubric v${pt.rubricVersion}`}
                    />
                    {/* Visual dot with mode-specific color */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? "6" : "4"}
                      fill={isSelected ? config.activeStroke : config.stroke}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      className="pointer-events-none transition-all duration-150"
                    />
                  </g>
                );
              })}

              {/* X-Axis bottom line */}
              <line
                x1={padding.left}
                y1={padding.top + chartHeight}
                x2={600 - padding.right}
                y2={padding.top + chartHeight}
                stroke="#CBD5E1"
                strokeWidth="1"
              />

              {/* X-Axis Dates for first and last point */}
              {pointsWithCoords.length > 0 && (
                <>
                  <text
                    x={pointsWithCoords[0].x}
                    y={padding.top + chartHeight + 18}
                    textAnchor="start"
                    fontSize="10"
                    fill="#64748B"
                  >
                    {new Date(pointsWithCoords[0].completedAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" }
                    )}
                  </text>
                  <text
                    x={pointsWithCoords[pointsWithCoords.length - 1].x}
                    y={padding.top + chartHeight + 18}
                    textAnchor="end"
                    fontSize="10"
                    fill="#64748B"
                  >
                    {new Date(
                      pointsWithCoords[pointsWithCoords.length - 1].completedAt
                    ).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </text>
                </>
              )}
            </svg>
          </div>

          {/* Active Data Point Inspection Card */}
          {activePoint ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-indigo-50/60 border border-indigo-200/80 text-xs">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-indigo-600" />
                <span className="font-semibold text-indigo-950">
                  {activePoint.role}
                </span>
                <Badge variant="secondary" className="capitalize text-[10px]">
                  {activePoint.mode} ({activePoint.difficulty})
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  v{activePoint.rubricVersion}
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-slate-600">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(activePoint.completedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                  {activePoint.overallScore} / 100
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic text-center">
              Hover over or tap any data point on the chart to inspect individual interview scores.
            </p>
          )}

          {/* Accessible Textual Summary */}
          {trendSummary && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100 leading-relaxed">
              <strong className="text-slate-800">Observed Trajectory: </strong>
              {trendSummary}
            </div>
          )}

          {/* Truthful rubric context disclaimer */}
          <p className="text-[11px] text-slate-600 flex items-center gap-1">
            <Info className="h-3 w-3 shrink-0 text-slate-600" />
            <span>
              {minimumDataNotice ||
                "Scores reflect evaluations calibrated against the specific rubric weights of each interview mode."}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
