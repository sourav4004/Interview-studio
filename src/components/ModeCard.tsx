interface ModeCardProps {
  title: string;
  description: string;
  tag: string;
}

export function ModeCard({ title, description, tag }: ModeCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[#171827]">{title}</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#EEF2FF] text-[#4F46E5]">
          {tag}
        </span>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
