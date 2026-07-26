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
      className="rounded-full border border-ink-600 px-4 py-2 text-xs text-chalk-dim transition hover:border-ink-500 hover:text-chalk"
    >
      {spinning ? "Refreshing…" : "Refresh ↻"}
    </button>
  );
}
