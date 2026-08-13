"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/store";
import { isOrgLevel } from "@/lib/permissions";
import type { AppUser, Role } from "@/lib/types";
import { apiClient, ApiError, setApiSession, type OrganisationLookup } from "@/lib/apiClient";
import { mapApiUserToAppUser } from "@/lib/apiMapping";
import { Building2, UserRound, Globe2, Loader2 } from "lucide-react";

function destinationFor(u: AppUser | null | undefined) {
  if (!u) return "/employee";
  if (u.role === "internal") return "/internal";
  return isOrgLevel(u) ? "/dashboard" : "/employee";
}

export default function LoginPage() {
  const router = useRouter();
  const { loginAsDemoUser, hydrateRealAccount, users } = useApp();
  const [role, setRole] = useState<Role>("organisation");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [orgChoices, setOrgChoices] = useState<OrganisationLookup[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");

  const demoUsers = users.filter((u) => u.role === role);

  async function loginToOrganisation(organisationId: string, organisationName: string) {
    const tokens = await apiClient.login({ email, password, organisation_id: organisationId });
    setApiSession(tokens.access_token, tokens.refresh_token);
    const profile = await apiClient.me();
    const appUser = mapApiUserToAppUser(profile, organisationId);
    hydrateRealAccount(appUser, { id: organisationId, name: organisationName, sector: "", kycVerified: true });
    router.push(destinationFor(appUser));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Enter an email and password to continue.");
      return;
    }
    if (role === "internal") {
      setError("SafeIQ Internal sign-in isn't wired to the real backend yet - use a demo account below.");
      return;
    }

    setBusy(true);
    try {
      if (selectedOrgId) {
        const match = orgChoices.find((o) => o.organisation_id === selectedOrgId);
        await loginToOrganisation(selectedOrgId, match?.organisation_name ?? "");
        return;
      }

      const matches = await apiClient.lookupOrganisations(email);
      if (matches.length === 0) {
        setError("No account found for that email on the real backend. Try a demo account below, or create one.");
        return;
      }
      if (matches.length > 1) {
        setOrgChoices(matches);
        setSelectedOrgId(matches[0].organisation_id);
        return;
      }
      await loginToOrganisation(matches[0].organisation_id, matches[0].organisation_name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong signing you in.");
    } finally {
      setBusy(false);
    }
  }

  function quickLogin(userId: string) {
    loginAsDemoUser(userId);
    const u = users.find((x) => x.id === userId);
    router.push(destinationFor(u));
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold text-slate-900 mb-1">Welcome back</h2>
      <p className="text-sm text-slate-500 mb-6">Sign in to your SafeIQ account.</p>

      <div className="grid grid-cols-3 gap-2 mb-6 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => setRole("organisation")}
          className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs sm:text-sm font-medium transition-colors ${
            role === "organisation" ? "bg-white shadow-sm text-brand" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Building2 size={16} /> Organisation
        </button>
        <button
          onClick={() => setRole("employee")}
          className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs sm:text-sm font-medium transition-colors ${
            role === "employee" ? "bg-white shadow-sm text-brand" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <UserRound size={16} /> Employee
        </button>
        <button
          onClick={() => setRole("internal")}
          className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs sm:text-sm font-medium transition-colors ${
            role === "internal" ? "bg-white shadow-sm text-brand" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Globe2 size={16} /> SafeIQ Internal
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Work email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setOrgChoices([]);
              setSelectedOrgId("");
            }}
            placeholder="you@company.co.uk"
          />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {orgChoices.length > 1 && (
          <div>
            <Label>Which organisation?</Label>
            <Select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>
              {orgChoices.map((o) => (
                <option key={o.organisation_id} value={o.organisation_id}>
                  {o.organisation_name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Signing in...
            </>
          ) : (
            "Sign in"
          )}
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
