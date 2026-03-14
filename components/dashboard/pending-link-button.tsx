"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

type PendingLinkButtonProps = {
  href: string;
  className: string;
  label: string;
  pendingLabel?: string;
};

export function PendingLinkButton({
  href,
  className,
  label,
  pendingLabel = "Loading...",
}: PendingLinkButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isClicked, setIsClicked] = useState(false);

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        setIsClicked(true);
        startTransition(() => {
          router.push(href);
        });
      }}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-75`}
    >
      {isPending && isClicked ? pendingLabel : label}
    </button>
  );
}
