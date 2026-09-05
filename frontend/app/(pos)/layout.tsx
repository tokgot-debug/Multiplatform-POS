"use client";

import type { ReactNode } from "react";

import { SignIn } from "@/components/sign-in";
import { PosSessionProvider, usePosSession } from "@/components/pos-session";
import { Sidebar } from "@/components/sidebar";

/**
 * The POS shell. Until a PIN is accepted the tablet lock screen is the only
 * thing rendered, exactly as the original app started locked.
 */
function Shell({ children }: { children: ReactNode }) {
  const { ready, bootError, user } = usePosSession();

  if (bootError) {
    return (
      <div
        style={{ position: "fixed", top: 0, left: 0, width: "100%", background: "#f43f5e", color: "#fff", padding: 12, textAlign: "center", zIndex: 99999, fontSize: 12, fontWeight: "bold" }}
      >
        {`Database Initialization Error: ${bootError}`}
      </div>
    );
  }

  if (!ready || !user) return <SignIn />;

  return (
    <div id="pos-shell">
      <Sidebar />
      <main className="app-main-content">{children}</main>
    </div>
  );
}

export default function PosLayout({ children }: { children: ReactNode }) {
  return (
    <PosSessionProvider>
      <Shell>{children}</Shell>
    </PosSessionProvider>
  );
}
