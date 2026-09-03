"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { AuthCard, AuthCardHeader } from "@/components/auth/AuthCard";
import { AuthInput, AuthSelect } from "@/components/auth/AuthField";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";
import { apiClient, ApiError, type OrganisationLookup } from "@/lib/apiClient";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

type Stage = "email" | "org" | "otp" | "password" | "done";

const RESEND_SECONDS = 48;

export default function ForgotPasswordPage() {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [orgChoices, setOrgChoices] = useState<OrganisationLookup[]>([]);
  const [orgId, setOrgId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (stage !== "otp" || resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [stage, resendIn]);

  async function sendCode(organisationId?: string) {
    setBusy(true);
    setError("");
    try {
      const res = await apiClient.forgotPassword({ email: email.trim(), organisation_id: organisationId });
      if (res.organisation_id) setOrgId(res.organisation_id);
      setResendIn(RESEND_SECONDS);
      setStage("otp");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Email is in more than one organisation - let them choose.
        try {
          const choices = await apiClient.lookupOrganisations(email.trim());
          setOrgChoices(choices);
          setOrgId(choices[0]?.organisation_id ?? "");
          setStage("org");
        } catch {
          setError("Could not look up your organisations. Try again.");
        }
      } else {
        setError(err instanceof ApiError ? err.message : "Could not send a reset code. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPassword() {
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiClient.resetPassword({ email: email.trim(), organisation_id: orgId, code, new_password: password });
      setStage("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset your password. Check the code and try again.");
    } finally {
      setBusy(false);
    }
  }

  const footer = (
    <span className="text-[var(--text-soft)]">
      Remembered it?{" "}
      <Link href="/login" className="font-bold text-brand hover:underline">
        Back to sign in
      </Link>
    </span>
  );

  return (
    <AuthShell footer={footer}>
      <AuthCard className="flex flex-col gap-8">
        {stage === "email" && (
          <>
            <AuthCardHeader title="Forgot Password" subtitle="Enter your email address to receive a reset code." align="center" />
            <div className="flex flex-col gap-3">
              <AuthInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.co.uk"
                icon={<Mail size={16} />}
                autoComplete="email"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <Button
                className="mt-1 w-full rounded-[var(--r-control)]"
                size="lg"
                disabled={!email.includes("@") || busy}
                onClick={() => sendCode()}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : (
                  <>
                    Continue <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {stage === "org" && (
          <>
            <AuthCardHeader title="Which organisation?" subtitle="This email belongs to more than one organisation." align="center" />
            <div className="flex flex-col gap-3">
              <AuthSelect label="Organisation" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                {orgChoices.map((o) => (
                  <option key={o.organisation_id} value={o.organisation_id}>
                    {o.organisation_name}
                  </option>
                ))}
              </AuthSelect>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <Button
                className="mt-1 w-full rounded-[var(--r-control)]"
                size="lg"
                disabled={!orgId || busy}
                onClick={() => sendCode(orgId)}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : (
                  <>
                    Send code <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {stage === "otp" && (
          <>
            <AuthCardHeader title="Enter code" subtitle={`Enter the 6-digit code we sent to ${email || "your email"}.`} align="center" />
            <div className="flex flex-col items-center gap-4">
              <OtpInput value={code} onChange={setCode} length={6} autoFocus ariaLabel="Reset code" />
              <p className="text-sm text-slate-500">
                {resendIn > 0 ? (
                  `Resend in ${resendIn} secs`
                ) : (
                  <button type="button" className="font-bold text-[var(--brand-dark)] hover:underline" onClick={() => void sendCode(orgId)}>
                    Resend code
                  </button>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <Button
                className="w-full rounded-[var(--r-control)]"
                size="lg"
                disabled={code.length !== 6 || busy}
                onClick={() => {
                  setError("");
                  setStage("password");
                }}
              >
                Continue <ArrowRight size={16} />
              </Button>
              <Button variant="outlineBrand" className="w-full rounded-[var(--r-control)]" size="lg" onClick={() => setStage("email")}>
                <ArrowLeft size={16} /> Back
              </Button>
            </div>
          </>
        )}

        {stage === "password" && (
          <>
            <AuthCardHeader title="Set New Password" subtitle="Choose a new password for your account." align="center" />
            <div className="flex flex-col gap-3">
              <AuthInput
                label="New Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                icon={<Lock size={16} />}
                hint="At least 10 characters."
                trailing={
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="flex">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
              <AuthInput
                label="Confirm New Password"
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••••"
                icon={<Lock size={16} />}
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <Button
                className="mt-1 w-full rounded-[var(--r-control)]"
                size="lg"
                disabled={busy || password.length < 10}
                onClick={submitNewPassword}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : (
                  <>
                    Reset password <ArrowRight size={16} />
                  </>
                )}
              </Button>
              <Button variant="outlineBrand" className="w-full rounded-[var(--r-control)]" size="lg" onClick={() => setStage("otp")}>
                <ArrowLeft size={16} /> Back
              </Button>
            </div>
          </>
        )}

        {stage === "done" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 size={40} className="text-emerald-500" />
            <AuthCardHeader title="Password updated" subtitle="You can now sign in with your new password." align="center" />
            <Link
              href="/login"
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              Back to sign in <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </AuthCard>
    </AuthShell>
  );
}
