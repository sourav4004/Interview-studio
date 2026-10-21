import Link from "next/link";
import { PublicHeader } from "@/components/shell/PublicHeader";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Code2,
  Users,
  FileText,
  Building2,
  ShieldCheck,
  Lock,
  Cpu,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const INTERVIEW_MODES = [
  {
    title: "Technical Interview",
    description:
      "Core data structures, algorithms, problem solving, and software design questions benchmarked for entry-level engineering roles.",
    badge: "Core CS",
    icon: Code2,
  },
  {
    title: "HR & Behavioral",
    description:
      "Structured behavioral prompts utilizing the STAR framework to build confidence in communication and cultural alignment.",
    badge: "STAR Method",
    icon: Users,
  },
  {
    title: "Resume-Based",
    description:
      "Targeted deep dives into your projects, coursework, and experience with automated server-side identifier redaction.",
    badge: "Project Focus",
    icon: FileText,
  },
  {
    title: "Company-Specific",
    description:
      "Custom interview simulations reflecting target company styles, transparently distinguishing verified benchmarks from user context.",
    badge: "Targeted",
    icon: Building2,
  },
];

const ARCHITECTURE_PILLARS = [
  {
    title: "Privacy-First Baseline",
    description:
      "Zero permanent audio or video recordings and no visual AI scoring in the MVP. Purpose-specific consent is enforced on every request and persistence boundary.",
    icon: ShieldCheck,
  },
  {
    title: "Server-Side Isolation",
    description:
      "Model keys and sensitive database credentials never enter client bundles. All environment variables and AI provider inputs/outputs are strictly validated by Zod.",
    icon: Lock,
  },
  {
    title: "Truthful Evidence Evaluation",
    description:
      "Evaluation reports attribute concrete evidence and mark uncertainty explicitly. Scores measure interview performance without making intelligence or employability claims.",
    icon: Cpu,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-[#171827]">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section
          aria-labelledby="hero-heading"
          className="relative overflow-hidden py-16 sm:py-24 border-b border-indigo-100/80 bg-gradient-to-b from-white via-white to-[#EEF2FF]/40"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2">
                <Badge variant="primary">
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-[#4F46E5]" />
                  Placement &amp; Internship Preparation
                </Badge>
              </div>

              <h1
                id="hero-heading"
                className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#171827] leading-[1.15]"
              >
                Realistic AI Interview Practice for Campus Placements
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Prepare for competitive campus hiring with structured technical,
                behavioral, and resume-based simulations. Receive truthful,
                evidence-based feedback under rigorous privacy standards.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto">
                    <span>Explore Workspace Shell</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
                <a href="#modes" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    <span>View Interview Modes</span>
                  </Button>
                </a>
              </div>

              <p className="text-xs text-slate-500 pt-2">
                Milestone 2 Design System active · Backend integrations scheduled in sequential roadmap milestones.
              </p>
            </div>
          </div>
        </section>

        {/* Planned Interview Modes Section */}
        <section
          id="modes"
          aria-labelledby="modes-heading"
          className="py-16 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6"
        >
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <Badge variant="secondary">Four Simulation Tracks</Badge>
            <h2
              id="modes-heading"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-[#171827]"
            >
              Planned Interview Modes
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every simulation mode is engineered around structured questioning,
              explicit answer confirmation, and multi-dimensional rubric scoring.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {INTERVIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <Card
                  key={mode.title}
                  className="hover:border-indigo-200 hover:shadow-md transition-all duration-200"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-10 h-10 rounded-lg bg-[#EEF2FF] flex items-center justify-center text-[#4F46E5] border border-indigo-100">
                        <Icon className="w-5 h-5" />
                      </div>
                      <Badge variant="primary">{mode.badge}</Badge>
                    </div>
                    <CardTitle className="text-lg">{mode.title}</CardTitle>
                    <CardDescription>{mode.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Foundation Architecture Section */}
        <section
          id="principles"
          aria-labelledby="principles-heading"
          className="py-16 sm:py-20 bg-white border-y border-slate-200/80"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
              <Badge variant="secondary">Security &amp; Architecture</Badge>
              <h2
                id="principles-heading"
                className="text-2xl sm:text-3xl font-bold tracking-tight text-[#171827]"
              >
                Engineered for Integrity and Trust
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Key architectural guarantees verified in our planning and readiness audit.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {ARCHITECTURE_PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <Card key={pillar.title} variant="default">
                    <CardHeader>
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-[#171827] mb-3">
                        <Icon className="w-5 h-5" />
                      </div>
                      <CardTitle className="text-base">{pillar.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {pillar.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} AI Interview Simulator. Phase 4 baseline.</p>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="hover:text-[#4F46E5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
            >
              Workspace Shell
            </Link>
            <span>·</span>
            <span>WCAG 2.2 AA Verified</span>
            <span>·</span>
            <span>Next.js App Router</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
