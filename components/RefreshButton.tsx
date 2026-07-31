"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Re-runs the server component's data fetch without a full page reload. */
export default function RefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function refresh() {
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 500);
  }

  return (
    <button
      onClick={refresh}
      className="rounded-full border border-rule px-4 py-2 text-xs text-graphite-muted transition hover:border-rule-strong hover:text-graphite"
    >
      {spinning ? "Refreshing…" : "Refresh ↻"}
    </button>
  );
}
