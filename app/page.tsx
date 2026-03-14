import Link from "next/link";
import { ArrowRight, BookOpen, ChartSpline, ShieldCheck } from "lucide-react";

const highlights = [
  {
    title: "Every learner gets a next best step",
    description:
      "Guide students through math with pacing that responds to performance, confidence, and momentum.",
    icon: BookOpen,
  },
  {
    title: "Teachers see movement early",
    description:
      "Spot progress, friction, and support needs before small gaps become bigger setbacks.",
    icon: ChartSpline,
  },
  {
    title: "Trust is part of the experience",
    description:
      "Keep access simple, secure, and dependable for classrooms, schools, and families.",
    icon: ShieldCheck,
  },
] as const;

export default function Home() {
  return (
    <main id="main-content" className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-hero-grid bg-[size:48px_48px] opacity-40" />
      <section className="container py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-primary/15 bg-white/80 px-4 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur">
              Math-first adaptive learning
            </div>
            <div className="space-y-5">
              <p className="font-mono text-sm uppercase tracking-[0.3em] text-primary/70">
                Carnegie Learning Blueprint
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-foreground md:text-7xl">
                Help every student move forward with confidence.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                Deliver personalized learning journeys, clearer teacher insight,
                and a steady path from practice to mastery.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform duration-200 hover:-translate-y-0.5"
              >
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full border border-border bg-white/70 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-white"
              >
                Create account
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-[0_24px_80px_rgba(31,41,55,0.12)] backdrop-blur">
            <div className="space-y-4 rounded-[1.5rem] bg-slate-900 p-6 text-slate-50">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-[0.25em] text-slate-400">
                  Why it matters
                </span>
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-medium text-emerald-200">
                  pilot ready
                </span>
              </div>
              <div className="space-y-3">
                <p className="text-3xl font-semibold">Learning that keeps moving</p>
                <p className="text-sm leading-7 text-slate-300">
                  Build a classroom experience that meets students where they are,
                  helps educators act sooner, and turns progress into momentum.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4">
              {highlights.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-accent p-3 text-accent-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-lg font-semibold">{title}</h2>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

