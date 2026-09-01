"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { AuthCard, AuthCardHeader } from "@/components/auth/AuthCard";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { AuthInput, AuthSelect } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/store";
import { isOrgLevel } from "@/lib/permissions";
import type { AppUser, Role } from "@/lib/types";
import { apiClient, ApiError, setApiSession, type OrganisationLookup } from "@/lib/apiClient";
import { internalApiClient, setInternalSession } from "@/lib/internalApiClient";
import { internalUserToAppUser, mapApiUserToAppUser } from "@/lib/apiMapping";
import { Building2, UserRound, Globe2, Loader2, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

function destinationFor(u: AppUser | null | undefined) {
  if (!u) return "/employee";
  if (u.role === "internal") return "/internal";
  return isOrgLevel(u) ? "/dashboard" : "/employee";
}

const ROLE_TABS = [
  { value: "organisation" as Role, label: "Organisation", icon: Building2 },
  { value: "employee" as Role, label: "Employee", icon: UserRound },
  { value: "internal" as Role, label: "Internal", icon: Globe2 },
];

export default function LoginPage() {
  const router = useRouter();
  const { loginAsDemoUser, hydrateRealAccount, users } = useApp();
  const [role, setRole] = useState<Role>("organisation");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
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
      setBusy(true);
      try {
        const tokens = await internalApiClient.login(email, password);
        setInternalSession(tokens.access_token, tokens.refresh_token);
        const me = await internalApiClient.me();
        hydrateRealAccount(internalUserToAppUser(me));
        router.push("/internal");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not sign in to SafeIQ Internal.");
      } finally {
        setBusy(false);
      }
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
    <AuthShell
      footer={
        <span className="text-[var(--text-soft)]">
          New to SafeIQ?{" "}
          <Link href="/signup" className="font-bold text-brand hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      <AuthCard className="flex flex-col gap-8">
        <AuthCardHeader title="Welcome back" subtitle="Sign in to your SafeIQ account." align="center" />

        <SegmentedTabs
          options={ROLE_TABS}
          value={role}
          onChange={(r) => {
            setRole(r);
            setOrgChoices([]);
            setSelectedOrgId("");
            setError("");
          }}
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <AuthInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setOrgChoices([]);
              setSelectedOrgId("");
            }}
            placeholder="you@company.co.uk"
            icon={<Mail size={16} />}
            autoComplete="email"
          />
          <AuthInput
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            icon={<Lock size={16} />}
            autoComplete="current-password"
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="flex"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          {orgChoices.length > 1 && (
            <AuthSelect label="Which organisation?" value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>
              {orgChoices.map((o) => (
                <option key={o.organisation_id} value={o.organisation_id}>
                  {o.organisation_name}
                </option>
              ))}
            </AuthSelect>
          )}

          <div className="flex items-center justify-between gap-4 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded accent-[var(--brand-dark)]"
              />
              Remember For 30 Days
            </label>
            <Link href="/forgot-password" className="text-sm font-bold text-[var(--brand-dark)] hover:underline">
              Forgot Password
            </Link>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <Button type="submit" className="mt-1 w-full rounded-[var(--r-control)]" size="lg" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Signing in...
              </>
            ) : (
              <>
                Sign In <ArrowRight size={16} />
              </>
            )}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          Or explore instantly as
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="flex flex-col gap-2">
          {demoUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => quickLogin(u.id)}
              className="flex w-full items-center gap-3 rounded-[var(--r-control)] border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-brand hover:bg-[var(--brand-tint)]/40"
            >
              <Avatar name={u.name} color={u.avatarColor} size={32} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{u.name}</p>
                <p className="truncate text-xs text-slate-500">{u.jobTitle}</p>
              </div>
            </button>
          ))}
        </div>
      </AuthCard>
    </AuthShell>
  );
}
