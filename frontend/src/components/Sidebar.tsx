"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  ShieldCheck,
  LogOut,
  Home,
  FolderKanban,
  Globe2,
} from "lucide-react";

const orgNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
  { href: "/team", label: "Team", icon: Users },
  { href: "/rag", label: "RAG", icon: BrainCircuit },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

const employeeNav = [
  { href: "/employee", label: "Home", icon: Home },
  { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
  { href: "/employee/my-rags", label: "My RAGs", icon: FolderKanban },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

const internalNav = [
  { href: "/internal", label: "Overview", icon: Globe2 },
  { href: "/rag", label: "RAG", icon: BrainCircuit },
  { href: "/alerts", label: "Alerts", icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useApp();

  if (!currentUser) return null;
  const nav = currentUser.role === "internal" ? internalNav : isOrgLevel(currentUser) ? orgNav : employeeNav;

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-white/10 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-brand/90 flex items-center justify-center">
          <ShieldCheck size={17} className="text-white" />
        </div>
        <span className="font-semibold text-white tracking-tight">SafeIQ</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/employee" && item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 mb-1">
          <Avatar name={currentUser.name} color={currentUser.avatarColor} size={32} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
            <p className="text-xs text-slate-400 truncate">
              {currentUser.jobTitle}
              {currentUser.role === "organisation" && " · Super Admin"}
              {currentUser.teamRole === "administrator" && " · Administrator"}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>
    </aside>
  );
}
