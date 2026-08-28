"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { AuthCard, AuthCardHeader } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/lib/store";
import { apiClient, ApiError, decodeAccessTokenClaims, setApiSession, type ApiInvitePreview } from "@/lib/apiClient";
import { mapApiUserToAppUser } from "@/lib/apiMapping";
import { Loader2, ShieldCheck, XCircle, UserRound, Mail, Lock, ArrowRight } from "lucide-react";

/**
 * Screen 4 from Milestone 2's user workflow: "Employee join via magic link
 * -> auto-binds to the organisation." This is the one screen in this app
 * with no mock-store equivalent - accepting a real invite only makes sense
 * against the real backend, since the mock store has no invite tokens that
 * resolve to anything (see components/TeamPage's mock magicLink field,
 * which is decorative for the demo flow).
 */
export function AcceptInviteClient({ token: tokenProp }: { token: string }) {
  // Static export only pre-renders a single placeholder token (see
  // generateStaticParams in page.tsx); every real invite link relies on a CDN
  // fallback serving that placeholder shell for the request. Next's own
  // router state (useParams()) reflects whatever token was baked into that
  // shell at build time, not the real URL - it's the served *file's* params,
  // not the browser's. Reading window.location.pathname directly is the only
  // way to recover the token the visitor actually requested.
  const [urlToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const match = window.location.pathname.match(/\/invite\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  });
  const token = urlToken ?? tokenProp;
  const router = useRouter();
  const { hydrateRealAccount } = useApp();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [preview, setPreview] = useState<ApiInvitePreview | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    // Wait for the real token to be read from window.location (above) before
    // fetching - firing this with the placeholder/build-time token first
    // would briefly preview the wrong invite whenever a CDN fallback served
    // this shell for a different token.
    if (urlToken === null) return;
    let cancelled = false;
    apiClient
      .previewInvite(token)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "This invite link isn't valid.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, urlToken]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (!preview) return;
    setSubmitError("");
    setBusy(true);
    try {
      const tokens = await apiClient.acceptInvite(token, {
        full_name: fullName,
        email: preview?.email ? undefined : email,
        password,
      });
      setApiSession(tokens.access_token, tokens.refresh_token);
      const profile = await apiClient.me();
      // The invite-preview response only carries the org's name, not its id - the
      // access token's org_id claim is the reliable source for the mock-store bridge.
      const claims = decodeAccessTokenClaims(tokens.access_token);
      const orgId = claims?.org_id ?? profile.id;
      hydrateRealAccount(mapApiUserToAppUser(profile, orgId), { id: orgId, name: preview.organisation_name, sector: "", kycVerified: true });
      router.push("/employee");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not accept this invite.");
    } finally {
      setBusy(false);
    }
  }

  const backToSignIn = (
    <span className="text-[var(--text-soft)]">
      <Link href="/login" className="font-bold text-brand hover:underline">
        Back to sign in
      </Link>
    </span>
  );

  if (loading) {
    return (
      <AuthShell>
        <AuthCard className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Checking your invite...
        </AuthCard>
      </AuthShell>
    );
  }

  if (loadError || !preview) {
    return (
      <AuthShell footer={backToSignIn}>
        <AuthCard>
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <XCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">This invite link isn&apos;t valid</p>
              <p className="mt-1 text-xs text-red-600">{loadError || "It may have expired or already been used."}</p>
            </div>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  if (preview.status !== "pending") {
    return (
      <AuthShell footer={backToSignIn}>
        <AuthCard>
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
            This invite to join <strong>{preview.organisation_name}</strong> is no longer pending (status: {preview.status}).
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell footer={backToSignIn}>
      <AuthCard className="flex flex-col gap-8">
        <AuthCardHeader
          title={`Join ${preview.organisation_name}`}
          subtitle={`You've been invited as ${preview.role.replace("_", " ")}. Set a password to finish joining.`}
        />

        <div className="flex items-start gap-2 rounded-lg bg-[var(--brand-tint)]/60 p-3 text-xs text-[var(--brand-dark)]">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <span>This creates a real account on the SafeIQ API, in {preview.organisation_name}&apos;s own isolated schema.</span>
        </div>

        <form onSubmit={accept} className="flex flex-col gap-3">
          <AuthInput
            label="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jamie Carter"
            icon={<UserRound size={16} />}
            required
          />
          {preview.email ? (
            <AuthInput label="Email" value={preview.email} icon={<Mail size={16} />} disabled />
          ) : (
            <AuthInput
              label="Your work email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.co.uk"
              icon={<Mail size={16} />}
              required
            />
          )}
          <AuthInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            icon={<Lock size={16} />}
            hint="At least 10 characters."
            required
            minLength={10}
          />
          {submitError && <p className="text-xs text-red-600">{submitError}</p>}
          <Button type="submit" className="mt-1 w-full rounded-[var(--r-control)]" size="lg" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Joining...
              </>
            ) : (
              <>
                Join organisation <ArrowRight size={16} />
              </>
            )}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
