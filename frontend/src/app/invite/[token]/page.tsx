"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Label, FormRow } from "@/components/ui/Field";
import { useApp } from "@/lib/store";
import { apiClient, ApiError, decodeAccessTokenClaims, setApiSession, type ApiInvitePreview } from "@/lib/apiClient";
import { mapApiUserToAppUser } from "@/lib/apiMapping";
import { Loader2, ShieldCheck, XCircle } from "lucide-react";

/**
 * Screen 4 from Milestone 2's user workflow: "Employee join via magic link
 * -> auto-binds to the organisation." This is the one screen in this app
 * with no mock-store equivalent - accepting a real invite only makes sense
 * against the real backend, since the mock store has no invite tokens that
 * resolve to anything (see components/TeamPage's mock magicLink field,
 * which is decorative for the demo flow).
 */
export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
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
  }, [token]);

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

  if (loading) {
    return (
      <AuthShell>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Checking your invite...
        </div>
      </AuthShell>
    );
  }

  if (loadError || !preview) {
    return (
      <AuthShell>
        <div className="flex items-start gap-2 rounded-lg bg-red-50 text-red-700 text-sm p-4">
          <XCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">This invite link isn&apos;t valid</p>
            <p className="text-xs text-red-600 mt-1">{loadError || "It may have expired or already been used."}</p>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="text-brand font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  if (preview.status !== "pending") {
    return (
      <AuthShell>
        <div className="rounded-lg bg-amber-50 text-amber-700 text-sm p-4">
          This invite to join <strong>{preview.organisation_name}</strong> is no longer pending (status: {preview.status}).
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="text-brand font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold text-slate-900 mb-1">Join {preview.organisation_name}</h2>
      <p className="text-sm text-slate-500 mb-6">
        You&apos;ve been invited as <strong>{preview.role.replace("_", " ")}</strong>. Set a password to finish joining.
      </p>

      <div className="flex items-start gap-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs p-3 mb-5">
        <ShieldCheck size={16} className="shrink-0 mt-0.5" />
        <span>This creates a real account on the SafeIQ API, in {preview.organisation_name}&apos;s own isolated schema.</span>
      </div>

      <form onSubmit={accept} className="space-y-4">
        <FormRow label="Your full name">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jamie Carter" required />
        </FormRow>
        {preview.email ? (
          <div>
            <Label>Email</Label>
            <Input value={preview.email} disabled />
          </div>
        ) : (
          <FormRow label="Your work email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.co.uk" required />
          </FormRow>
        )}
        <FormRow label="Password" hint="At least 10 characters.">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" required minLength={10} />
        </FormRow>
        {submitError && <p className="text-xs text-red-600">{submitError}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Joining...
            </>
          ) : (
            "Join organisation"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
