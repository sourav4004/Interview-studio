import React from "react";
import { LucideIcon } from "lucide-react";
import { Badge, BadgeVariant } from "@/components/ui/Badge";

interface StatCardProps {
  title: string;
  value: string | number | null;
  unit?: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: BadgeVariant;
  accent?: boolean;
}

export function StatCard({
  title,
  value,
  unit,
  description,
  icon: Icon,
  badge,
  badgeVariant = "secondary",
  accent = false,
}: StatCardProps) {
  const displayValue = value !== null && value !== undefined ? value : "—";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-5 transition-shadow hover:shadow-xs ${
        accent
          ? "border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/40"
          : "border-slate-200/90 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            accent
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-600"
          }`}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span
          className={`text-2xl font-bold tracking-tight ${
            accent ? "text-indigo-900" : "text-[#171827]"
          }`}
        >
          {displayValue}
        </span>
        {unit && value !== null && (
          <span className="text-xs font-medium text-slate-500">{unit}</span>
        )}
        {badge && (
          <div className="ml-auto">
            <Badge variant={badgeVariant}>{badge}</Badge>
          </div>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
