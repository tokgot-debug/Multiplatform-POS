"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { canViewTab, NAV_ITEMS } from "@/navigation";
import { showNotification } from "@/context";

import { usePosSession } from "./pos-session";

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

/**
 * Left sidebar. Markup matches the original index.html; the difference is that
 * nav items are links into the route tree rather than switchTab() calls, and
 * role filtering comes from the shared navigation table.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { user, queueCount, online, setOnline, signOut } = usePosSession();
  if (!user) return null;

  const activeTab = pathname.split("/").filter(Boolean)[0] ?? "";

  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo" style={{ padding: "10px 0", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <img src="/logo.png" alt="Titanium Logo" style={{ height: 38, objectFit: "contain" }} />
      </div>

      <div className="sidebar-status-row">
        <button
          type="button"
          id="connectivity-indicator"
          className={`status-badge ${online ? "online" : "offline"}`}
          onClick={() => {
            const next = !online;
            setOnline(next);
            showNotification(
              next
                ? "Back online. Draining outbox queue..."
                : "Simulating Offline Mode. Outbox queue will hold transactions.",
              next ? "success" : "warning",
            );
          }}
        >
          <span className="badge-dot" />
          <span className="badge-text">{online ? "Online" : "Offline"}</span>
        </button>
        <div id="fiscal-queue-indicator" className={`status-badge queued ${queueCount > 0 ? "" : "hidden"}`}>
          <span className="badge-text" id="fiscal-queue-count">{queueCount} Queued</span>
        </div>
      </div>

      <div className="sidebar-section-label">DASHBOARD MODULES</div>

      <nav className="sidebar-nav" id="sidebar-nav">
        {NAV_ITEMS.filter((item) => canViewTab(user.role, item.tab)).map((item) => (
          <Link
            key={item.tab}
            href={`/${item.tab}`}
            className={`sidebar-nav-btn ${activeTab === item.tab ? "active" : ""}`}
            data-tab={item.tab}
          >
            <span className="snb-icon">{item.icon}</span>
            <span className="snb-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar" id="sidebar-avatar">{initials(user.name)}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" id="sidebar-username">{user.name}</div>
            <div className="sidebar-user-role" id="sidebar-userrole">{user.role}</div>
          </div>
        </div>
        <button className="sidebar-signout-btn" id="lock-app" type="button" onClick={signOut}>
          <span>⏻</span> SIGN OUT
        </button>
      </div>
    </aside>
  );
}
