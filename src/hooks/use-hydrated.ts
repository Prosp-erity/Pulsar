"use client";

import { useSyncExternalStore } from "react";

/**
 * Returns true only after the component has mounted on the client.
 * Use this to guard rendering of values that differ between server
 * (default state) and client (localStorage-loaded state) to prevent
 * React hydration mismatches.
 *
 * Uses useSyncExternalStore with a server snapshot of false and a
 * client snapshot of true — the standard React 18+ pattern for
 * hydration detection.
 *
 * Pattern:
 *   const hydrated = useHydrated();
 *   return <span>{hydrated ? dynamicValue : "—"}</span>;
 */

// Empty subscribe — we never get updates, just read once
function subscribe() {
  return () => {};
}

// On the server, always returns false. On the client, returns true
// after the first render (getSnapshot is called after hydration).
function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
}
