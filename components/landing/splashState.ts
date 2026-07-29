"use client";

import { useSyncExternalStore } from "react";

/* ═══════════════════════════════════════════════════════════════
   Splash → hero handoff.

   The splash is a fixed overlay, so the hero mounts and animates
   *underneath* it. On a 4.4s curtain that means every entrance
   tween has already finished by the time the page is revealed and
   the hero just pops in, fully settled.

   This is the signal that fixes it: the splash publishes when it
   starts lifting, and the hero holds its entrance until then.

   A module-level store rather than context, because the splash and
   the hero are siblings under a Server Component page — wrapping
   them in a provider would force the whole page client-side.
   ═══════════════════════════════════════════════════════════════ */

let done = false;
const listeners = new Set<() => void>();

/** Called by SplashIntro the moment the curtain begins to lift. */
export function markSplashDone() {
  if (done) return;
  done = true;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * True once the splash has handed off. Always false on the server and
 * on the first client render, so SSR and hydration agree; the store
 * then re-renders subscribers when the curtain lifts.
 */
export function useSplashDone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => done,
    () => false,
  );
}
