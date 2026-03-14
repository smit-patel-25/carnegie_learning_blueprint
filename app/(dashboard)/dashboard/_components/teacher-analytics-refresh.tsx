"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 30_000;

type TeacherAnalyticsRefreshProps = {
  courseId: string;
};

function formatLastRefreshed(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export function TeacherAnalyticsRefresh({ courseId }: TeacherAnalyticsRefreshProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => Date.now());

  const triggerRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
      setLastRefreshedAt(Date.now());
    });
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      triggerRefresh();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [triggerRefresh]);

  const refreshedLabel = useMemo(() => {
    return formatLastRefreshed(lastRefreshedAt);
  }, [lastRefreshedAt]);

  return (
    <div className="rounded-[1.4rem] border border-sky-200 bg-sky-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-700">
            Live analytics
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Updates every 30 seconds for course{" "}
            <span className="font-semibold">{courseId.slice(0, 8)}</span>.
          </p>
          <p className="mt-1 text-xs text-slate-600">Last refreshed at {refreshedLabel}</p>
        </div>
        <button
          type="button"
          onClick={triggerRefresh}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Refreshing..." : "Refresh now"}
        </button>
      </div>
    </div>
  );
}
