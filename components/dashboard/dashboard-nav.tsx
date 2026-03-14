"use client";

import { useState, useTransition } from "react";

import { usePathname, useRouter } from "next/navigation";

type DashboardNavProps = {
  showLibraryLink: boolean;
  showParentLink: boolean;
};

type NavItem = {
  href: string;
  label: string;
};

function navClassName(isActive: boolean) {
  return `rounded-full border px-4 py-2 transition ${
    isActive
      ? "border-slate-900 bg-slate-900 text-white"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
  }`;
}

function isRouteActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav({ showLibraryLink, showParentLink }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const navItems: NavItem[] = [{ href: "/dashboard", label: "Dashboard" }];

  if (showLibraryLink) {
    navItems.push({ href: "/library", label: "Content library" });
  }

  if (showParentLink) {
    navItems.push({ href: "/parent", label: "Parent portal" });
  }

  return (
    <nav aria-label="Dashboard navigation" className="flex flex-wrap items-center gap-3 text-sm font-semibold">
      {navItems.map((item) => {
        const isActive = isRouteActive(pathname, item.href);
        const showPending = isPending && pendingHref === item.href;

        return (
          <button
            key={item.href}
            type="button"
            disabled={isPending || isActive}
            onClick={() => {
              setPendingHref(item.href);
              startTransition(() => {
                router.push(item.href);
              });
            }}
            className={`${navClassName(isActive)} disabled:cursor-not-allowed disabled:opacity-80`}
          >
            {showPending ? "Loading..." : item.label}
          </button>
        );
      })}
    </nav>
  );
}

