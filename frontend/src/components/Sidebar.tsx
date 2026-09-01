"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import { isOrgLevel } from "@/lib/permissions";
import { Avatar } from "@/components/ui/Avatar";
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
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

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
      { href: "/internal/onboarding", label: "Onboarding", icon: GraduationCap },
      { href: "/rag", label: "RAG", icon: BrainCircuit },
      { href: "/alerts", label: "Alerts", icon: ShieldCheck },
    ],
  },
];

function roleLabel(role: string) {
  if (role === "internal") return "INTERNAL";
  if (role === "organisation") return "ORGANISATION";
  return "EMPLOYEE";
}

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser } = useApp();

  if (!currentUser) return null;
  const groups = currentUser.role === "internal" ? internalNav : isOrgLevel(currentUser) ? orgNav : employeeNav;

  return (
    <aside
      className="sticky top-0 flex h-screen w-[264px] shrink-0 flex-col gap-1.5 px-4 py-6 text-[#e4e0f1]"
      style={{ backgroundColor: "var(--shell-bg)" }}
    >
      <div className="flex flex-1 flex-col gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 pb-4 pt-1">
          <div className="flex size-[34px] items-center justify-center rounded-[10px] bg-brand text-[15px] font-extrabold text-white">S</div>
          <div className="leading-tight">
            <p className="text-[16px] font-bold text-white">SafeIQ</p>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[#e4e0f1]">{roleLabel(currentUser.role)}</p>
          </div>
        </div>
        <div className="h-px w-full bg-white/10" />

        {/* Nav groups */}
        <nav className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-1.5">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c7becc]">{group.label}</p>
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/employee" && item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex h-[38px] items-center gap-3 rounded-[var(--r-control)] px-[11px] text-[13.5px] font-medium transition-colors ${
                      active ? "bg-brand text-white" : "text-[#e4e0f1] hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className="h-px w-full bg-white/10" />
      <Link
        href={`/team/${currentUser.id}`}
        className="flex items-center gap-3 rounded-[var(--r-control)] px-2 py-2 transition-colors hover:bg-white/5"
        title="View your own profile"
      >
        <Avatar name={currentUser.name} color={currentUser.avatarColor} size={40} className="rounded-[11px]" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-[#edeaef]">{currentUser.name}</p>
          <p className="truncate text-[11px] text-white/70">{currentUser.jobTitle}</p>
        </div>
      </Link>
    </aside>
  );
}
