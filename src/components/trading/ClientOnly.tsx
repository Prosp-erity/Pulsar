"use client";

import { useHydrated } from "@/hooks/use-hydrated";
import type { ReactNode } from "react";

/**
 * Renders children only after client hydration.
 * On the server and during the first client render, renders the fallback
 * (or nothing) instead. This prevents hydration mismatches for components
 * whose initial state differs between server (defaults) and client
 * (localStorage-loaded values).
 *
 * Usage:
 *   <ClientOnly fallback={<div className="h-32" />}>
 *     <DynamicComponent />
 *   </ClientOnly>
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const hydrated = useHydrated();
  if (!hydrated) return <>{fallback}</>;
  return <>{children}</>;
}
