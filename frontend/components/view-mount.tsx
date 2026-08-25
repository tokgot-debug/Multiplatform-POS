"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { canViewTab, DEFAULT_TAB } from "@/navigation";
import { showNotification } from "@/context";

import { usePosSession } from "./pos-session";

type ViewClass = new (container: HTMLElement) => { load: () => Promise<void> | void };

/**
 * Mounts one of the original view classes into this route.
 *
 * Each screen still renders through its own code, so the markup and styling are
 * the ones the client approved - there is no second implementation to drift.
 * Converting a screen to real JSX later means replacing one page's <ViewMount>
 * and nothing else.
 */
export function ViewMount({ tab, view: View }: { tab: string; view: ViewClass }) {
  const ref = useRef<HTMLElement | null>(null);
  const loadedFor = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const { ready, user } = usePosSession();

  const allowed = user ? canViewTab(user.role, tab) : false;

  useEffect(() => {
    if (!ready || !user || allowed) return;
    // Mirrors the original switchTab guard: refuse and bounce to the default.
    showNotification("Access Denied: Your access level does not permit viewing this module.", "error");
    router.replace(`/${DEFAULT_TAB}`);
  }, [ready, user, allowed, router]);

  useEffect(() => {
    const container = ref.current;
    if (!ready || !user || !allowed || !container) return;
    // React StrictMode invokes effects twice in development. The element is
    // reused across that pair, so keying on it renders the view exactly once.
    if (loadedFor.current === container) return;
    loadedFor.current = container;

    try {
      void new View(container).load();
    } catch (error) {
      console.error(`Failed to load the ${tab} view:`, error);
      showNotification("This module could not be opened. Check the console for details.", "error");
    }
  }, [ready, user, allowed, View, tab]);

  return <section ref={ref} id={`view-${tab}`} className="tab-view active" />;
}
