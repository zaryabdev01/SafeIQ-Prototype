"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { AuthCard, AuthCardHeader } from "@/components/auth/AuthCard";
import { AuthInput, AuthSelect, FieldLabel } from "@/components/auth/AuthField";
import { Stepper } from "@/components/auth/Stepper";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/lib/store";
import { COUNTRIES, LANGUAGES, SECTORS } from "@/lib/constants";
import type { Country, Language, Role } from "@/lib/types";
import { apiClient, ApiError, setApiSession } from "@/lib/apiClient";
import { mapApiUserToAppUser } from "@/lib/apiMapping";
import {
  Building2,
  UserRound,
  Check,
  UploadCloud,
  Camera,
  ShieldCheck,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  Layers,
  Globe2,
  Languages as LanguagesIcon,
  CalendarDays,
  MapPin,
  Hash,
  IdCard,
} from "lucide-react";

// The organisation path is real (calls the SafeIQ API); the employee path hands
// off to the real magic-link invite flow at /invite/[token] (see AGENTS.md /
// PROJECT_OVERVIEW.md — direct employee self-signup needs an organisation_id the
// UI can't resolve pre-auth).
const ORG_STEPS = ["Account Type", "Your details", "Verify email", "Identity check", "Review"];

function extractInviteToken(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/invite\/([^/?#]+)/);
  if (match) return decodeURIComponent(match[1]);
  return trimmed.replace(/^\/+|\/+$/g, "");
}

export default function SignupPage() {
  const router = useRouter();
  const { hydrateRealAccount } = useApp();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>("organisation");
  const [employeeJoin, setEmployeeJoin] = useState(false);
  const [inviteRef, setInviteRef] = useState("");

  const [orgName, setOrgName] = useState("");
  const [sector, setSector] = useState(SECTORS[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState<Country>("United Kingdom");
  const [language, setLanguage] = useState<Language>("English");

  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [idType, setIdType] = useState("Passport");
  const [idFileName, setIdFileName] = useState("");
  const [selfieTaken, setSelfieTaken] = useState(false);
  const [agree, setAgree] = useState(false);

  // Real-backend signup state (organisation path).
  const [busy, setBusy] = useState(false);
  const [apiError, setApiErrorMsg] = useState("");
  const [onboardingToken, setOnboardingToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [kycStatus, setKycStatus] = useState<"idle" | "checking" | "approved" | "rejected">("idle");

  const canContinueDetails = name && email && password.length >= 10 && orgName;
  const canContinueKyc = kycStatus === "approved" && dob && address && postcode && idFileName && selfieTaken;

  function back() {
    setApiErrorMsg("");
    if (step > 0) setStep(step - 1);
  }

  async function handleContinueFromDetails() {
    setBusy(true);
    setApiErrorMsg("");
    try {
      const result = await apiClient.signupOrganisation({
        organisation_name: orgName,
        sector,
        full_name: name,
        email,
        password,
      });
      setOnboardingToken(result.onboarding_token);
      setOrgId(result.org_id);
      setStep(2);
    } catch (err) {
      setApiErrorMsg(err instanceof ApiError ? err.message : "Something went wrong creating your organisation.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp() {
    setBusy(true);
    setApiErrorMsg("");
    try {
      await apiClient.verifyOtp({ onboarding_token: onboardingToken, code: otpCode });
      setStep(3);
    } catch (err) {
      setApiErrorMsg(err instanceof ApiError ? err.message : "Could not verify that code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStartKyc() {
    setBusy(true);
    setKycStatus("checking");
    setApiErrorMsg("");
    try {
      const result = await apiClient.startKyc(onboardingToken);
      setKycStatus(result.status === "approved" ? "approved" : "rejected");
    } catch (err) {
      setKycStatus("idle");
      setApiErrorMsg(err instanceof ApiError ? err.message : "Identity verification failed to start.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setApiErrorMsg("");
    try {
      const tokens = await apiClient.login({ email, password, organisation_id: orgId });
      setApiSession(tokens.access_token, tokens.refresh_token);
      await apiClient.updateSettings({ country, language });
      const profile = await apiClient.me();
      hydrateRealAccount(mapApiUserToAppUser(profile, orgId), { id: orgId, name: orgName, sector, kycVerified: true });
      router.push("/dashboard");
    } catch (err) {
      setApiErrorMsg(err instanceof ApiError ? err.message : "Could not complete sign-in after account creation.");
    } finally {
      setBusy(false);
    }
  }

  const footer = (
    <span className="text-[var(--text-soft)]">
      Already have an account?{" "}
      <Link href="/login" className="font-bold text-brand hover:underline">
        Sign In
      </Link>
    </span>
  );

  // --- Employee: hand off to the real invite flow ---
  if (employeeJoin) {
    return (
      <AuthShell footer={footer}>
        <div className="flex w-full max-w-[480px] flex-col gap-6">
          <Stepper count={5} current={0} />
          <AuthCard className="flex flex-col gap-8">
            <AuthCardHeader
              title="Join your organisation"
              subtitle="Employees join SafeIQ from the magic link their organisation sends. Paste that link or its code below."
            />
            <div className="flex flex-col gap-3">
              <AuthInput
                label="Invite link or code"
                value={inviteRef}
                onChange={(e) => setInviteRef(e.target.value)}
                placeholder="https://app.safeiq.co/invite/…  or  mg-7f3a9c"
                icon={<Mail size={16} />}
              />
              <Button
                className="mt-1 w-full rounded-[var(--r-control)]"
                size="lg"
                disabled={!inviteRef.trim()}
                onClick={() => router.push(`/invite/${encodeURIComponent(extractInviteToken(inviteRef))}`)}
              >
                Continue <ArrowRight size={16} />
              </Button>
              <Button
                variant="outlineBrand"
                className="w-full rounded-[var(--r-control)]"
                size="lg"
                onClick={() => {
                  setEmployeeJoin(false);
                  setRole("organisation");
                }}
              >
                <ArrowLeft size={16} /> Back
              </Button>
            </div>
          </AuthCard>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell footer={footer}>
      <div className="flex w-full max-w-[480px] flex-col gap-6">
        <Stepper count={5} current={step} />

        <AuthCard className="flex flex-col gap-8">
          <AuthCardHeader
            title={step === 4 ? "Review" : ORG_STEPS[step]}
            subtitle={
              step === 0
                ? "Fill out the steps to create your account."
                : step === 2
                  ? "Enter the code we sent to your email."
                  : step === 4
                    ? "Review the information below to create your account."
                    : "Fill out the steps to create your account."
            }
          />

          {apiError && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{apiError}</p>
          )}

          {/* Step 0 — Account type */}
          {step === 0 && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setRole("organisation")}
                className={`rounded-[var(--r-field)] border-2 p-4 text-left transition-colors ${
                  role === "organisation" ? "border-brand bg-[var(--brand-tint)]/50" : "border-[var(--border-default)] hover:border-slate-300"
                }`}
              >
                <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-tint)] text-brand">
                  <Building2 size={18} />
                </span>
                <p className="text-sm font-bold text-[var(--text-strong)]">Organization</p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">Set up RAG systems and manage your team&apos;s AI agent access.</p>
              </button>
              <button
                type="button"
                onClick={() => setRole("employee")}
                className={`rounded-[var(--r-field)] border-2 p-4 text-left transition-colors ${
                  role === "employee" ? "border-brand bg-[var(--brand-tint)]/50" : "border-[var(--border-default)] hover:border-slate-300"
                }`}
              >
                <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-tint)] text-brand">
                  <UserRound size={18} />
                </span>
                <p className="text-sm font-bold text-[var(--text-strong)]">Employee</p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">Join an organization you&apos;ve been invited to via magic link.</p>
              </button>

              <Button
                className="mt-1 w-full rounded-[var(--r-control)]"
                size="lg"
                onClick={() => (role === "employee" ? setEmployeeJoin(true) : setStep(1))}
              >
                Continue <ArrowRight size={16} />
              </Button>
            </div>
          )}

          {/* Step 1 — Your details (organisation) */}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <AuthInput label="Organisation name" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Bright Care Homes Ltd" icon={<Building2 size={16} />} />
              <AuthSelect label="Sector" value={sector} onChange={(e) => setSector(e.target.value)} icon={<Layers size={16} />}>
                {SECTORS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </AuthSelect>
              <AuthInput label="Your full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Carter" icon={<UserRound size={16} />} />
              <AuthInput label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.co.uk" icon={<Mail size={16} />} />
              <AuthInput label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" icon={<Lock size={16} />} hint="At least 10 characters." />
              <div className="grid grid-cols-2 gap-3">
                <AuthSelect label="Country" value={country} onChange={(e) => setCountry(e.target.value as Country)} icon={<Globe2 size={16} />}>
                  {COUNTRIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </AuthSelect>
                <AuthSelect label="Language" value={language} onChange={(e) => setLanguage(e.target.value as Language)} icon={<LanguagesIcon size={16} />}>
                  {LANGUAGES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </AuthSelect>
              </div>
              <p className="text-xs text-[var(--text-soft)]">This path creates a real account on the SafeIQ API - not a demo persona.</p>
              <StepButtons
                onNext={handleContinueFromDetails}
                onBack={back}
                nextLabel="Next"
                nextDisabled={!canContinueDetails || busy}
                busy={busy}
              />
            </div>
          )}

          {/* Step 2 — Verify email */}
          {step === 2 && (
            <div className="flex flex-col items-center gap-8">
              <div className="flex flex-col items-center gap-4">
                <OtpInput value={otpCode} onChange={setOtpCode} length={6} autoFocus />
                <p className="text-sm text-slate-500">
                  The dev backend logs the code to its console - check the terminal running <code>uvicorn</code>.
                </p>
              </div>
              <div className="w-full">
                <StepButtons
                  onNext={handleVerifyOtp}
                  onBack={back}
                  nextLabel="Next"
                  nextDisabled={otpCode.length !== 6 || busy}
                  busy={busy}
                />
              </div>
            </div>
          )}

          {/* Step 3 — Identity check (KYC) */}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 rounded-lg bg-[var(--brand-tint)]/60 p-3 text-xs text-[var(--brand-dark)]">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                <span>Standard KYC step. This calls the real backend&apos;s KYC endpoint - the provider is TBC with the client, so the dev backend auto-approves.</span>
              </div>
              <AuthInput label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} icon={<CalendarDays size={16} />} />
              <AuthInput label="Home address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="14 Aire Street" icon={<MapPin size={16} />} />
              <AuthInput label="Postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="LS1 4PR" icon={<Hash size={16} />} />
              <AuthSelect label="ID document type" value={idType} onChange={(e) => setIdType(e.target.value)} icon={<IdCard size={16} />}>
                <option>Passport</option>
                <option>Driving licence</option>
                <option>National ID card</option>
              </AuthSelect>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-[7px]">
                  <FieldLabel>Upload {idType.toLowerCase()}</FieldLabel>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--r-field)] border-2 border-dashed border-[var(--border-default)] bg-[var(--surface-warm)] py-6 transition-colors hover:border-brand">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-tint)] text-brand">
                      <UploadCloud size={16} />
                    </span>
                    <span className="px-2 text-center text-xs text-[var(--text-soft)]">{idFileName || "Click to choose a file"}</span>
                    <input type="file" className="hidden" onChange={(e) => setIdFileName(e.target.files?.[0]?.name ?? "id-document.jpg")} />
                  </label>
                </div>
                <div className="flex flex-col gap-[7px]">
                  <FieldLabel>Selfie verification</FieldLabel>
                  <button
                    type="button"
                    onClick={() => setSelfieTaken(true)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-[var(--r-field)] border-2 border-dashed py-6 transition-colors ${
                      selfieTaken ? "border-emerald-400 bg-emerald-50/50" : "border-[var(--border-default)] bg-[var(--surface-warm)] hover:border-brand"
                    }`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${selfieTaken ? "bg-emerald-100 text-emerald-600" : "bg-[var(--brand-tint)] text-brand"}`}>
                      {selfieTaken ? <Check size={16} /> : <Camera size={16} />}
                    </span>
                    <span className="text-xs text-[var(--text-soft)]">{selfieTaken ? "Selfie captured" : "Simulate selfie capture"}</span>
                  </button>
                </div>
              </div>
              <Button
                variant={kycStatus === "approved" ? "outline" : "primary"}
                className="w-full rounded-[var(--r-control)]"
                onClick={handleStartKyc}
                disabled={busy || kycStatus === "approved"}
              >
                {busy && kycStatus === "checking" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Verifying...
                  </>
                ) : kycStatus === "approved" ? (
                  <>
                    <Check size={14} className="text-emerald-600" /> Identity verified
                  </>
                ) : (
                  <>
                    Start Identity Verification <ArrowRight size={16} />
                  </>
                )}
              </Button>
              <StepButtons onNext={() => setStep(4)} onBack={back} nextLabel="Next" nextDisabled={!canContinueKyc} />
            </div>
          )}

          {/* Step 4 — Review */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div className="divide-y divide-[var(--border-default)] rounded-[var(--r-field)] border border-[var(--border-default)] text-sm">
                {[
                  ["Account Type", "Organization"],
                  ["Name", name || "-"],
                  ["Organisation", orgName || "-"],
                  ["Email", email || "-"],
                  ["Country", country],
                  ["Language", language],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between px-4 py-2.5">
                    <span className="text-[var(--text-soft)]">{k}</span>
                    <span className="font-semibold text-[var(--text-strong)]">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-[var(--text-soft)]">Identity Check</span>
                  <span className="font-semibold text-emerald-600">Verified</span>
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-xs text-[var(--text-body)]">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-[var(--brand-dark)]" />
                I agree to the SafeIQ terms of service and privacy policy (UK GDPR compliant, data hosted in the UK).
              </label>
              <StepButtons
                onNext={finish}
                onBack={back}
                nextLabel="Create Account"
                nextDisabled={!agree || busy}
                busy={busy}
              />
            </div>
          )}
        </AuthCard>
      </div>
    </AuthShell>
  );
}

/** Stacked full-width Next / Back pair used at the foot of the wizard steps. */
function StepButtons({
  onNext,
  onBack,
  nextLabel,
  nextDisabled,
  busy,
  hideNext,
}: {
  onNext: () => void;
  onBack: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  busy?: boolean;
  hideNext?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!hideNext && (
        <Button className="w-full rounded-[var(--r-control)]" size="lg" onClick={onNext} disabled={nextDisabled}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : (
            <>
              {nextLabel} <ArrowRight size={16} />
            </>
          )}
        </Button>
      )}
      <Button variant="outlineBrand" className="w-full rounded-[var(--r-control)]" size="lg" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </Button>
    </div>
  );
}
