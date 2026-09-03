"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import { isOrgLevel } from "@/lib/permissions";
import { Avatar } from "@/components/ui/Avatar";
import { WordmarkLogo } from "@/components/auth/WordmarkLogo";
import { AuthPanelBlob } from "@/components/auth/AuthPanelBlob";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  BrainCircuit,
  CalendarDays,
  Settings,
  Home,
  FolderKanban,
  Globe2,
  Building2,
  ShieldAlert,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const SIDEBAR_WIDTH = 272;

const orgNav: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
      { href: "/team", label: "Team", icon: Users },
      { href: "/rag", label: "RAG", icon: BrainCircuit },
    ],
  },
  {
    label: "Operation",
    items: [
      { href: "/alert-library", label: "Alert Library", icon: ShieldAlert },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const employeeNav: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/employee", label: "Home", icon: Home },
      { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
      { href: "/employee/my-rags", label: "My RAGs", icon: FolderKanban },
    ],
  },
  {
    label: "Operation",
    items: [
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const internalNav: NavGroup[] = [
  {
    label: "Console",
    items: [
      { href: "/internal", label: "Overview", icon: Globe2 },
      { href: "/internal/organisations", label: "Organisations", icon: Building2 },
      { href: "/internal/people", label: "People", icon: Users },
      { href: "/internal/onboarding", label: "Onboarding", icon: GraduationCap },
      { href: "/rag", label: "RAG", icon: BrainCircuit },
      { href: "/alerts", label: "Alerts", icon: ShieldCheck },
    ],
  },
];

const EXACT_ONLY_HREFS = new Set(["/dashboard", "/employee", "/internal"]);

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function isNavItemActive(pathname: string, href: string): boolean {
  const path = normalizePath(pathname);
  const target = normalizePath(href);

  if (path === target) return true;
  if (EXACT_ONLY_HREFS.has(target)) return false;

  return path.startsWith(`${target}/`);
}

function roleLabel(role: string) {
  if (role === "internal") return "INTERNAL";
  if (role === "organisation") return "ORGANISATION";
  return "EMPLOYEE";
}

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const { currentUser } = useApp();

  if (!currentUser) return null;
  const groups = currentUser.role === "internal" ? internalNav : isOrgLevel(currentUser) ? orgNav : employeeNav;

  const profileHref = `/team/${currentUser.id}`;
  const profileActive = normalizePath(pathname) === profileHref;

  function handleNavClick() {
    onMobileClose?.();
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-[var(--shell-bg)]/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onMobileClose}
        aria-hidden={!mobileOpen}
      />

      <aside
        className={`sidebar-shell fixed inset-y-0 left-0 z-50 flex h-screen w-[min(100vw-3rem,272px)] max-w-[272px] shrink-0 flex-col overflow-hidden border-r border-white/[0.06] px-3 py-5 text-[#e4e0f1] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "var(--auth-panel-bg)", width: SIDEBAR_WIDTH }}
        aria-label="Main navigation"
      >
        <AuthPanelBlob
          idPrefix="sidebar"
          className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[340px] translate-x-[28%] translate-y-[18%]"
        />

        <div className="relative z-10 flex flex-1 flex-col gap-4 min-h-0">
          <div className="flex items-start justify-between gap-2 px-2 pb-1 shrink-0">
            <div className="min-w-0">
              <WordmarkLogo
                tone="light"
                href={currentUser.role === "employee" ? "/employee" : "/dashboard"}
                className="!text-[22px]"
              />
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45 pl-0.5">
                {roleLabel(currentUser.role)}
              </p>
            </div>
            <button
              type="button"
              onClick={onMobileClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-[var(--r-control)] text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <div className="h-px w-full shrink-0 bg-gradient-to-r from-transparent via-white/12 to-transparent" />

          <nav className="flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-1 sidebar-nav-scroll min-h-0">
            {groups.map((group, groupIndex) => (
              <div
                key={group.label}
                className="flex flex-col gap-1 animate-sidebar-group"
                style={{ animationDelay: `${groupIndex * 60}ms` }}
              >
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{group.label}</p>
                {group.items.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleNavClick}
                      aria-current={active ? "page" : undefined}
                      className={`sidebar-nav-link group relative flex h-[44px] items-center gap-3 rounded-[var(--r-control)] px-3 text-[15px] font-medium transition-all duration-300 ${
                        active
                          ? "sidebar-nav-active text-white"
                          : "text-[#e4e0f1]/85 hover:bg-white/[0.07] hover:text-white active:scale-[0.98]"
                      }`}
                    >
                      {active && (
                        <span
                          className="sidebar-nav-active-bar absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-white animate-nav-indicator"
                          aria-hidden
                        />
                      )}
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${
                          active
                            ? "bg-white/20 ring-1 ring-white/25"
                            : "bg-white/[0.04] group-hover:bg-white/[0.1] group-hover:ring-1 group-hover:ring-white/10"
                        }`}
                      >
                        <item.icon
                          size={17}
                          className={`transition-colors duration-300 ${active ? "text-white" : "text-[#c7bee2] group-hover:text-white"}`}
                        />
                      </span>
                      <span className={`truncate ${active ? "font-semibold" : ""}`}>{item.label}</span>
                      {active && (
                        <span
                          className="ml-auto size-1.5 shrink-0 rounded-full bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                          aria-hidden
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="relative z-10 mt-auto shrink-0 px-1 pb-1 pt-2 safe-bottom">
          <div className="mb-4 h-px w-full bg-white/20" />
          <Link
            href={profileHref}
            onClick={handleNavClick}
            aria-current={profileActive ? "page" : undefined}
            className="group flex items-center gap-3 px-2 py-1 transition-opacity hover:opacity-90"
            title="View your own profile"
          >
            <Avatar
              name={currentUser.name}
              color={currentUser.avatarColor}
              size={40}
              className="rounded-[10px] ring-1 ring-white/15"
            />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[15px] font-medium text-white">{currentUser.name}</p>
              <p className="mt-0.5 truncate text-[13px] text-white/70">
                {currentUser.jobTitle || roleLabel(currentUser.role)}
              </p>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}

export const sidebarWidth = SIDEBAR_WIDTH;
