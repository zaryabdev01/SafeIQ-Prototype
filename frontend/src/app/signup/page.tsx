"use client";

import { useEffect, useState } from "react";
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
import {
  apiClient,
  ApiError,
  decodeAccessTokenClaims,
  setApiSession,
  type ApiInvitePreview,
} from "@/lib/apiClient";
import { mapApiUserToAppUser } from "@/lib/apiMapping";
import { extractInviteToken } from "@/lib/invite";
import {
  Building2,
  UserRound,
  Check,
  UploadCloud,
  Camera,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  Layers,
  Globe2,
  Languages as LanguagesIcon,
  MapPin,
  Home,
  IdCard,
  CalendarDays,
  Eye,
  EyeOff,
} from "lucide-react";

// Account type is NOT a numbered step.
// Organisation: 4 steps → Your Details → Verify Email (OTP) → KYC → Review
// Employee: 5 stepper circles → join, details, KYC, review (+ visual buffer)
const ORG_WIZARD_TITLES = ["Your Details", "Verify Email", "KYC Verification", "Review"] as const;
const EMP_WIZARD_TITLES = [
  "Join your organization",
  "Your Details",
  "KYC Verification",
  "Review",
] as const;
const ORG_STEP_COUNT = 4;
const EMPLOYEE_STEP_COUNT = 5;
const RESEND_SECONDS = 48;

export default function SignupPage() {
  const router = useRouter();
  const { hydrateRealAccount } = useApp();

  // 0 = account type (no stepper). After that, path-specific wizard index (0-based).
  const [phase, setPhase] = useState<"account" | "org" | "employee">("account");
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>("organisation");

  const [inviteRef, setInviteRef] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [invitePreview, setInvitePreview] = useState<ApiInvitePreview | null>(null);

  const [orgName, setOrgName] = useState("");
  const [sector, setSector] = useState(SECTORS[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState<Country>("United Kingdom");
  const [language, setLanguage] = useState<Language>("English");

  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [idType, setIdType] = useState("Passport");
  const [idFileName, setIdFileName] = useState("");
  const [selfieTaken, setSelfieTaken] = useState(false);
  const [agree, setAgree] = useState(false);

  const [busy, setBusy] = useState(false);
  const [apiError, setApiErrorMsg] = useState("");
  const [onboardingToken, setOnboardingToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [kycStatus, setKycStatus] = useState<"idle" | "checking" | "approved" | "rejected">("idle");

  const isEmployee = phase === "employee";
  const canContinueOrgDetails = name && email && password.length >= 10 && orgName;
  const canContinueEmpDetails = name && email && password.length >= 10;
  const canContinueKyc =
    kycStatus === "approved" && dob && address && postcode && idFileName && selfieTaken;

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  function resetWizardExtras() {
    setApiErrorMsg("");
    setOtpCode("");
    setKycStatus("idle");
    setAgree(false);
    setDob("");
    setAddress("");
    setPostcode("");
    setIdFileName("");
    setSelfieTaken(false);
  }

  function goAccountType() {
    setPhase("account");
    setStep(0);
    setInviteError("");
    resetWizardExtras();
  }

  function back() {
    setApiErrorMsg("");
    if (phase === "account") return;
    if (step === 0) {
      goAccountType();
      return;
    }
    setStep(step - 1);
  }

  function startResendTimer() {
    setResendIn(RESEND_SECONDS);
  }

  async function handleContinueFromOrgDetails() {
    // The org is created once, on the first pass through this step. Stepping
    // back and forward again must not create a duplicate organisation.
    if (onboardingToken) {
      setStep(1);
      startResendTimer();
      return;
    }
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
      setStep(1);
      startResendTimer();
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
      setStep(2);
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
      if (isEmployee) {
        // Invite accept has no KYC API — mirror the org UX with a local approve.
        await new Promise((r) => setTimeout(r, 600));
        setKycStatus("approved");
      } else {
        const result = await apiClient.startKyc(onboardingToken);
        setKycStatus(result.status === "approved" ? "approved" : "rejected");
      }
    } catch (err) {
      setKycStatus("idle");
      setApiErrorMsg(err instanceof ApiError ? err.message : "Identity verification failed to start.");
    } finally {
      setBusy(false);
    }
  }

  async function finishOrg() {
    setBusy(true);
    setApiErrorMsg("");
    try {
      const tokens = await apiClient.login({ email, password, organisation_id: orgId });
      setApiSession(tokens.access_token, tokens.refresh_token);
      await apiClient.updateSettings({ country, language });
      const profile = await apiClient.me();
      hydrateRealAccount(mapApiUserToAppUser(profile, orgId), {
        id: orgId,
        name: orgName,
        sector,
        kycVerified: true,
      });
      router.push("/dashboard");
    } catch (err) {
      setApiErrorMsg(err instanceof ApiError ? err.message : "Could not complete sign-in after account creation.");
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteContinue() {
    const token = extractInviteToken(inviteRef);
    if (!token) {
      setInviteError(
        "Enter a valid SafeIQ invite link (e.g. https://app.safeiq.io/join/mg-…) or paste the invite code from that link.",
      );
      return;
    }
    setBusy(true);
    setInviteError("");
    setApiErrorMsg("");
    try {
      const preview = await apiClient.previewInvite(token);
      if (preview.status !== "pending") {
        setInviteError(`This invite is no longer pending (status: ${preview.status}).`);
        return;
      }
      setInviteToken(token);
      setInvitePreview(preview);
      if (preview.email) setEmail(preview.email);
      setStep(1);
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "This invite link isn't valid.");
    } finally {
      setBusy(false);
    }
  }

  function handleEmpDetailsNext() {
    setApiErrorMsg("");
    if (!canContinueEmpDetails) return;
    setStep(2);
  }

  async function finishEmployee() {
    setBusy(true);
    setApiErrorMsg("");
    try {
      const tokens = await apiClient.acceptInvite(inviteToken, {
        full_name: name,
        email: invitePreview?.email ? undefined : email,
        password,
      });
      setApiSession(tokens.access_token, tokens.refresh_token);
      await apiClient.updateSettings({ country, language });
      const profile = await apiClient.me();
      const claims = decodeAccessTokenClaims(tokens.access_token);
      const joinedOrgId = claims?.org_id ?? profile.id;
      hydrateRealAccount(mapApiUserToAppUser(profile, joinedOrgId), {
        id: joinedOrgId,
        name: invitePreview?.organisation_name ?? "",
        sector: "",
        kycVerified: true,
      });
      router.push("/employee");
    } catch (err) {
      setApiErrorMsg(err instanceof ApiError ? err.message : "Could not accept this invite.");
    } finally {
      setBusy(false);
    }
  }

  const footer = (
    <span className="text-[var(--text-soft)]">
      Already have an Account?{" "}
      <Link href="/login" className="font-bold text-brand hover:underline">
        Sign In
      </Link>
    </span>
  );

  // Organisation: content steps map 1:1 to the 4 stepper circles.
  // Employee: first circle is a visual buffer once the path is chosen.
  const stepperCurrent = isEmployee ? step + 1 : step;
  const stepperCount = isEmployee ? EMPLOYEE_STEP_COUNT : ORG_STEP_COUNT;
  const showStepper = phase !== "account";

  function headerFor() {
    if (phase === "account") {
      return {
        title: "Account Type",
        subtitle: "Fill out the steps to create your account.",
      };
    }
    if (phase === "employee") {
      const title = EMP_WIZARD_TITLES[step];
      if (step === 0) {
        return {
          title,
          subtitle: "Employees join SafeIQ from the magic link their organisation sends. Paste that link or its code below.",
        };
      }
      if (step === 3) {
        return { title, subtitle: "Review the information below to create account" };
      }
      return { title, subtitle: "Fill out the steps to create your account." };
    }
    const title = ORG_WIZARD_TITLES[step] ?? "Review";
    if (step === 3) {
      return { title: "Review", subtitle: "Review the information below to create account" };
    }
    return { title, subtitle: "Fill out the steps to create your account." };
  }

  const header = headerFor();

  return (
    <AuthShell footer={footer} panel="signup">
      <div className="flex w-full max-w-[480px] flex-col gap-6">
        {showStepper && <Stepper count={stepperCount} current={stepperCurrent} />}

        <AuthCard className="flex flex-col gap-8">
          <AuthCardHeader title={header.title} subtitle={header.subtitle} />

          {apiError && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{apiError}</p>
          )}

          {/* Account type */}
          {phase === "account" && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setRole("organisation")}
                className={`rounded-[var(--r-field)] border-2 p-4 text-left transition-colors ${
                  role === "organisation"
                    ? "border-brand bg-[var(--brand-tint)]/50"
                    : "border-[var(--border-default)] hover:border-slate-300"
                }`}
              >
                <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-tint)] text-brand">
                  <Building2 size={18} />
                </span>
                <p className="text-sm font-bold text-[var(--text-strong)]">Organization</p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">
                  Set up RAG systems and manage your team&apos;s AI agent access.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setRole("employee")}
                className={`rounded-[var(--r-field)] border-2 p-4 text-left transition-colors ${
                  role === "employee"
                    ? "border-brand bg-[var(--brand-tint)]/50"
                    : "border-[var(--border-default)] hover:border-slate-300"
                }`}
              >
                <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-tint)] text-brand">
                  <UserRound size={18} />
                </span>
                <p className="text-sm font-bold text-[var(--text-strong)]">Employee</p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">
                  Join an organization you&apos;ve been invited to via magic link.
                </p>
              </button>

              <Button
                className="mt-1 w-full rounded-[14px]"
                size="lg"
                onClick={() => {
                  resetWizardExtras();
                  setStep(0);
                  if (role === "employee") setPhase("employee");
                  else setPhase("org");
                }}
              >
                Continue <ArrowRight size={16} />
              </Button>
            </div>
          )}

          {/* Employee step 0 — Join */}
          {phase === "employee" && step === 0 && (
            <div className="flex flex-col gap-3">
              <AuthInput
                label="Invite Link"
                value={inviteRef}
                onChange={(e) => {
                  setInviteRef(e.target.value);
                  setInviteError("");
                }}
                placeholder="https://"
                hint="Sent to you by your organisation via magic link"
              />
              {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
              <StepButtons
                onBack={back}
                onNext={handleInviteContinue}
                nextLabel="Continue"
                nextDisabled={!inviteRef.trim() || busy}
                busy={busy}
              />
            </div>
          )}

          {/* Employee step 1 — Your Details */}
          {phase === "employee" && step === 1 && (
            <div className="flex flex-col gap-3">
              {invitePreview && (
                <p className="rounded-lg bg-[var(--brand-tint)]/60 px-3 py-2 text-xs text-[var(--brand-dark)]">
                  Joining <strong>{invitePreview.organisation_name}</strong> as{" "}
                  {invitePreview.role.replace("_", " ")}.
                </p>
              )}
              <AuthInput
                label="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mustafa Afridi"
                icon={<UserRound size={16} />}
              />
              <AuthInput
                label="Work email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.co.uk"
                icon={<Mail size={16} />}
                disabled={Boolean(invitePreview?.email)}
              />
              <AuthInput
                label="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                icon={<Lock size={16} />}
                hint="At least 10 characters."
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="flex text-[#9a93a1] hover:text-[var(--text-soft)]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
              <AuthSelect
                label="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value as Country)}
                icon={<Globe2 size={16} />}
              >
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </AuthSelect>
              <AuthSelect
                label="Language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                icon={<LanguagesIcon size={16} />}
              >
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </AuthSelect>
              <StepButtons
                onBack={back}
                onNext={handleEmpDetailsNext}
                nextLabel="Next"
                nextDisabled={!canContinueEmpDetails}
              />
            </div>
          )}

          {/* Org verify email (OTP) — step 2 of 4 */}
          {phase === "org" && step === 1 && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-4">
                <OtpInput value={otpCode} onChange={setOtpCode} length={6} autoFocus />
                <div className="flex flex-col items-center gap-1 text-center">
                  <p className="text-sm text-[var(--text-soft)]">
                    {resendIn > 0 ? `Resend in ${resendIn} secs` : "Didn't get a code?"}
                  </p>
                  <button
                    type="button"
                    disabled={resendIn > 0}
                    onClick={() => startResendTimer()}
                    className="text-sm font-bold text-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Resend Code
                  </button>
                </div>
              </div>
              <StepButtons
                onBack={back}
                onNext={handleVerifyOtp}
                nextLabel="Next"
                nextDisabled={otpCode.length !== 6 || busy}
                busy={busy}
              />
            </div>
          )}

          {/* Shared KYC (org step 3 / employee step 3) */}
          {((phase === "org" && step === 2) || (phase === "employee" && step === 2)) && (
            <div className="flex flex-col gap-3">
              <AuthInput
                label="Date of birth"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                trailing={<CalendarDays size={16} className="text-[var(--text-soft)]" />}
              />
              <AuthInput
                label="Home address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="14 Aire Street"
                icon={<MapPin size={16} />}
              />
              <AuthInput
                label="Postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="LS1 4PR"
                icon={<Home size={16} />}
              />
              <AuthSelect
                label="ID document type"
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                icon={<IdCard size={16} />}
              >
                <option>Passport</option>
                <option>Driving licence</option>
                <option>National ID card</option>
              </AuthSelect>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-[7px]">
                  <FieldLabel>Upload {idType.toLowerCase()}</FieldLabel>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--r-field)] border-2 border-dashed border-brand/35 bg-[var(--brand-tint)]/50 py-6 transition-colors hover:border-brand">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-tint)] text-brand">
                      <UploadCloud size={16} />
                    </span>
                    <span className="px-2 text-center text-xs text-[var(--text-soft)]">
                      {idFileName || "Click to choose a file"}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setIdFileName(e.target.files?.[0]?.name ?? "id-document.jpg")}
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-[7px]">
                  <FieldLabel>Selfie verification</FieldLabel>
                  <button
                    type="button"
                    onClick={() => setSelfieTaken(true)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-[var(--r-field)] border-2 border-dashed py-6 transition-colors ${
                      selfieTaken
                        ? "border-emerald-400 bg-emerald-50/50"
                        : "border-brand/35 bg-[var(--brand-tint)]/50 hover:border-brand"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        selfieTaken ? "bg-emerald-100 text-emerald-600" : "bg-[var(--brand-tint)] text-brand"
                      }`}
                    >
                      {selfieTaken ? <Check size={16} /> : <Camera size={16} />}
                    </span>
                    <span className="text-xs text-[var(--text-soft)]">
                      {selfieTaken ? "Selfie captured" : "Simulate selfie capture"}
                    </span>
                  </button>
                </div>
              </div>
              {kycStatus === "checking" && (
                <p className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
                  <Loader2 size={14} className="animate-spin" /> Verifying identity…
                </p>
              )}
              {kycStatus === "approved" && (
                <p className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
                  <Check size={14} /> Identity verified
                </p>
              )}
              <StepButtons
                onBack={back}
                onNext={kycStatus === "approved" ? () => setStep(3) : handleStartKyc}
                nextLabel={kycStatus === "approved" ? "Next" : "Start Identity Verification"}
                nextDisabled={
                  kycStatus === "approved"
                    ? !canContinueKyc
                    : busy || !dob || !address || !postcode || !idFileName || !selfieTaken
                }
                busy={busy && kycStatus === "checking"}
              />
            </div>
          )}

          {/* Shared Review (org step 3 / employee step 3) */}
          {((phase === "org" && step === 3) || (phase === "employee" && step === 3)) && (
            <div className="flex flex-col gap-4">
              <div className="divide-y divide-[var(--border-default)] rounded-[var(--r-field)] border border-[var(--border-default)] text-sm">
                {(isEmployee
                  ? [
                      ["Account Type", "Employee"],
                      ["Name", name || "-"],
                      ["Email", email || "-"],
                      ["Country", country],
                      ["Language", language],
                    ]
                  : [
                      ["Account Type", "Organization"],
                      ["Organization", orgName || "-"],
                      ["Name", name || "-"],
                      ["Email", email || "-"],
                      ["Country", country],
                      ["Language", language],
                    ]
                ).map(([k, v]) => (
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
              <label className="flex cursor-pointer items-start gap-2.5 text-xs text-[var(--text-body)]">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="auth-checkbox mt-0.5"
                />
                I agree to the SafeIQ terms of service and privacy policy (UK GDPR compliant, data hosted in
                the UK).
              </label>
              <StepButtons
                onBack={back}
                onNext={isEmployee ? finishEmployee : finishOrg}
                nextLabel="Create Account"
                nextDisabled={!agree || busy}
                busy={busy}
              />
            </div>
          )}

          {/* Org step 0 — Your Details */}
          {phase === "org" && step === 0 && (
            <div className="flex flex-col gap-3">
              {onboardingToken && (
                <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Your organisation has already been created. Editing these fields won&apos;t change it — continue to verify your email.
                </p>
              )}
              <AuthInput
                label="Organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Bright Care Homes Ltd"
                icon={<Building2 size={16} />}
              />
              <AuthSelect label="Sector" value={sector} onChange={(e) => setSector(e.target.value)} icon={<Layers size={16} />}>
                {SECTORS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </AuthSelect>
              <AuthInput
                label="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jamie Carter"
                icon={<UserRound size={16} />}
              />
              <AuthInput
                label="Work email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.co.uk"
                icon={<Mail size={16} />}
              />
              <AuthInput
                label="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                icon={<Lock size={16} />}
                hint="At least 10 characters."
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="flex text-[#9a93a1] hover:text-[var(--text-soft)]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
              <AuthSelect
                label="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value as Country)}
                icon={<Globe2 size={16} />}
              >
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </AuthSelect>
              <AuthSelect
                label="Language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                icon={<LanguagesIcon size={16} />}
              >
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </AuthSelect>
              <StepButtons
                onBack={back}
                onNext={handleContinueFromOrgDetails}
                nextLabel="Next"
                nextDisabled={!canContinueOrgDetails || busy}
                busy={busy}
              />
            </div>
          )}
        </AuthCard>
      </div>
    </AuthShell>
  );
}

function StepButtons({
  onNext,
  onBack,
  nextLabel,
  nextDisabled,
  busy,
}: {
  onNext: () => void;
  onBack: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="mt-1 flex gap-3">
      <Button variant="outlineBrand" className="shrink-0 rounded-[14px] px-5" size="lg" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </Button>
      <Button className="min-w-0 flex-1 rounded-[14px]" size="lg" onClick={onNext} disabled={nextDisabled}>
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            {nextLabel} <ArrowRight size={16} />
          </>
        )}
      </Button>
    </div>
  );
}
