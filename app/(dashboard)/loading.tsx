export default function DashboardLoading() {
  return (
    <main className="container py-10 md:py-16">
      <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="animate-pulse space-y-5 rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(31,41,55,0.12)] md:p-8">
          <div className="h-3 w-32 rounded-full bg-slate-200" />
          <div className="h-10 w-3/4 rounded-2xl bg-slate-200" />
          <div className="h-4 w-full rounded-full bg-slate-100" />
          <div className="h-4 w-5/6 rounded-full bg-slate-100" />
          <div className="space-y-3">
            <div className="h-24 rounded-[1.5rem] bg-slate-100" />
            <div className="h-24 rounded-[1.5rem] bg-slate-100" />
          </div>
        </section>
        <section className="animate-pulse space-y-4 rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(31,41,55,0.12)] md:p-8">
          <div className="h-3 w-28 rounded-full bg-slate-200" />
          <div className="h-10 w-2/3 rounded-2xl bg-slate-200" />
          <div className="h-4 w-full rounded-full bg-slate-100" />
          <div className="h-4 w-4/5 rounded-full bg-slate-100" />
          <div className="h-40 rounded-[1.5rem] bg-slate-100" />
        </section>
      </div>
    </main>
  );
}
