"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Menu, X, Layers3, Command } from "lucide-react";
import { useAdminSession, PermissionDenied } from "./admin-session";
import { navigation } from "@/lib/navigation";
import {AdminNotificationBadge} from "./admin-inbox";
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/download" || pathname === "/download/test" || pathname === "/test-admin" || pathname === "/site" || pathname === "/invite" || pathname.startsWith('/legal/'))
    return <>{children}</>;
  return <AdminConsole pathname={pathname}>{children}</AdminConsole>;
}
function AdminConsole({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { access, phase, gate, logout, busy, error } = useAdminSession();
  const visibleNavigation = navigation.filter(item => access?.allowedModules.includes(item.slug));
  const module = pathname.split("/")[1];
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link href={access?.landing ?? "/dashboard"} className="wordmark" onClick={() => setOpen(false)}>
          <img src="/brand/dt-monogram.svg" width="46" height="46" alt="" />
          <span>
            DT Exchange<small>OPERATIONS CONSOLE</small>
          </span>
        </Link>
        <button
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <nav aria-label="Admin navigation">
          {visibleNavigation.map((item, i) => {
            const active = pathname === "/" + item.slug;
            const Icon = item.icon;
            return (
              <div key={item.slug}>
                {(i === 0 || visibleNavigation[i - 1]?.group !== item.group) && (
                  <p className="nav-group">{item.group}</p>
                )}
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`nav-link ${active ? "selected" : ""}`}
                  href={"/" + item.slug}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={18} strokeWidth={1.65} />
                  <span>{item.label}</span>
                  {active && <span className="nav-dot" />}
                </Link>
              </div>
            );
          })}
        </nav>
        {access?.allowedModules.includes("settings") && <Link href="/settings" className="system-link" onClick={() => setOpen(false)}>
          <Layers3 size={18} />
          <span>
            Operational settings<small>DT Exchange · v1.0</small>
          </span>
          <ArrowUpRight size={16} />
        </Link>}
      </aside>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="top-breadcrumb">
              DT Exchange <span>/</span>{" "}
              {pathname === "/"
                ? "Dashboard"
                : (navigation.find((n) => pathname === "/" + n.slug)?.label ??
                  "Not found")}
            </span>
          </div>
          <div className="topbar-right">
            {phase === "authenticated" && access?.allowedModules.includes("notifications") && <AdminNotificationBadge/>}
            {phase === "authenticated" && <button type="button" disabled={busy} onClick={() => void logout()}>Sign out</button>}
            <span className="preview-pill">
              <span />
              Operations console
            </span>
            <span className="avatar" aria-label="DT Exchange">
              DT
            </span>
          </div>
        </header>
        <main id="main">{gate ?? (access && <>
          {error && <p role="alert">{error}</p>}
          {access.allowedModules.includes(module) ? children : <PermissionDenied access={access} unavailable={access.unavailableModules.includes(module)} />}
        </>)}</main>
        <footer className="workspace-footer">
          <span>
            DT Exchange <span>·</span> Sell USDT. Receive INR.
          </span>
          <span>
            <Command size={13} /> Thoughtfully simple.
          </span>
        </footer>
      </div>
    </div>
  );
}
