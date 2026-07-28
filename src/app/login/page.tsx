"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Building2, UserRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginAsDemoUser, users } = useApp();
  const [role, setRole] = useState<Role>("organisation");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const demoUsers = users.filter((u) => u.role === role);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter an email and password to continue.");
      return;
    }
    const ok = login(email, role);
    if (ok) {
      router.push(role === "organisation" ? "/dashboard" : "/employee");
    } else {
      setError("No account found for that role. Try a demo account below.");
    }
  }

  function quickLogin(userId: string) {
    loginAsDemoUser(userId);
    router.push(role === "organisation" ? "/dashboard" : "/employee");
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold text-slate-900 mb-1">Welcome back</h2>
      <p className="text-sm text-slate-500 mb-6">Sign in to your SafeIQ account.</p>

      <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => setRole("organisation")}
          className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
            role === "organisation" ? "bg-white shadow-sm text-brand" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Building2 size={16} /> Organisation
        </button>
        <button
          onClick={() => setRole("employee")}
          className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
            role === "employee" ? "bg-white shadow-sm text-brand" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <UserRound size={16} /> Employee
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Work email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.co.uk" />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button type="submit" className="w-full" size="lg">
          Sign in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px bg-slate-200 flex-1" />
        Or explore instantly as
        <div className="h-px bg-slate-200 flex-1" />
      </div>

      <div className="space-y-2">
        {demoUsers.map((u) => (
          <button
            key={u.id}
            onClick={() => quickLogin(u.id)}
            className="w-full flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-brand hover:bg-indigo-50/30 transition-colors"
          >
            <Avatar name={u.name} color={u.avatarColor} size={32} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
              <p className="text-xs text-slate-500 truncate">{u.jobTitle}</p>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        New to SafeIQ?{" "}
        <Link href="/signup" className="text-brand font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
