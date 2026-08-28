"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { AuthCard, AuthCardHeader } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthField";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

type Stage = "email" | "otp" | "password" | "done";

const RESEND_SECONDS = 48;

export default function ForgotPasswordPage() {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
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

  // Password reset has no backend endpoint yet — every step here is simulated
  // client-side so the redesigned flow can be reviewed (see PROJECT_OVERVIEW.md
  // "real vs. mock").
  function simulate(next: Stage) {
    setBusy(true);
    setError("");
    setTimeout(() => {
      setBusy(false);
      if (next === "otp") setResendIn(RESEND_SECONDS);
      setStage(next);
    }, 600);
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
            <AuthCardHeader title="Forgot Password" subtitle="Enter your email address to receive a reset code." />
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
                onClick={() => simulate("otp")}
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

        {stage === "otp" && (
          <>
            <AuthCardHeader title="Enter OTP" subtitle={`Enter the code we sent to ${email || "your email"}.`} />
            <div className="flex flex-col items-center gap-4">
              <OtpInput value={code} onChange={setCode} length={4} autoFocus ariaLabel="Reset code" />
              <p className="text-sm text-slate-500">
                {resendIn > 0 ? (
                  `Resend in ${resendIn} secs`
                ) : (
                  <button type="button" className="font-bold text-[var(--brand-dark)] hover:underline" onClick={() => setResendIn(RESEND_SECONDS)}>
                    Resend Code
                  </button>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full rounded-[var(--r-control)]"
                size="lg"
                disabled={code.length !== 4 || busy}
                onClick={() => simulate("password")}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : (
                  <>
                    Continue <ArrowRight size={16} />
                  </>
                )}
              </Button>
              <Button
                variant="outlineBrand"
                className="w-full rounded-[var(--r-control)]"
                size="lg"
                onClick={() => setStage("email")}
              >
                <ArrowLeft size={16} /> Back
              </Button>
            </div>
          </>
        )}

        {stage === "password" && (
          <>
            <AuthCardHeader title="Set New Password" subtitle="Choose a new password for your account." />
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
                onClick={() => {
                  if (password !== confirm) {
                    setError("Passwords don't match.");
                    return;
                  }
                  simulate("done");
                }}
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
