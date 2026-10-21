export function Header() {
  return (
    <header className="border-b border-indigo-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            AI
          </div>
          <div>
            <span className="font-semibold text-lg text-[#171827] tracking-tight">
              AI Interview Simulator
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEF2FF] text-[#4F46E5] border border-indigo-200">
            Phase 4 · Foundation
          </span>
        </div>
      </div>
    </header>
  );
}
