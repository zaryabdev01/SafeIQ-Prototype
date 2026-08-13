"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FormRow } from "@/components/ui/Field";
import { useApp } from "@/lib/store";
import { COUNTRIES, LANGUAGES, SECTORS } from "@/lib/constants";
import type { Country, Language, Role } from "@/lib/types";
import { apiClient, ApiError, setApiSession } from "@/lib/apiClient";
import { mapApiUserToAppUser } from "@/lib/apiMapping";
import { Building2, UserRound, Check, UploadCloud, Camera, ShieldCheck, Loader2, MailCheck } from "lucide-react";

const EMPLOYEE_STEPS = ["Account type", "Your details", "Identity check", "Review"];
const ORG_STEPS = ["Account type", "Your details", "Verify email", "Identity check", "Review"];

export default function SignupPage() {
  const router = useRouter();
  const { signupEmployee, hydrateRealAccount } = useApp();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>("organisation");

  const STEPS = role === "organisation" ? ORG_STEPS : EMPLOYEE_STEPS;

  const [orgName, setOrgName] = useState("");
  const [sector, setSector] = useState(SECTORS[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [country, setCountry] = useState<Country>("United Kingdom");
  const [language, setLanguage] = useState<Language>("English");

  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [idType, setIdType] = useState("Passport");
  const [idFileName, setIdFileName] = useState("");
  const [selfieTaken, setSelfieTaken] = useState(false);
  const [agree, setAgree] = useState(false);

  // Real-backend signup state (organisation path only - see AGENTS.md / root README
  // for why the employee path here stays on the mock store).
  const [busy, setBusy] = useState(false);
  const [apiError, setApiErrorMsg] = useState("");
  const [onboardingToken, setOnboardingToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [kycStatus, setKycStatus] = useState<"idle" | "checking" | "approved" | "rejected">("idle");

  const isOrgFlow = role === "organisation";

  const canGoNext =
    (step === 0 && role) ||
    (step === 1 && name && email && (isOrgFlow ? password.length >= 10 : true) && (role === "employee" || orgName)) ||
    (isOrgFlow && step === 2 && otpCode.length === 6) ||
    (step === (isOrgFlow ? 3 : 2) && (isOrgFlow ? kycStatus === "approved" : dob && address && postcode && idFileName && selfieTaken)) ||
    step === STEPS.length - 1;

  function back() {
    setApiErrorMsg("");
    if (step > 0) setStep(step - 1);
  }

  async function handleContinueFromDetails() {
    if (!isOrgFlow) {
      setStep(step + 1);
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
      setStep(step + 1);
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
      setStep(step + 1);
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

  function next() {
    if (step === 1) {
      void handleContinueFromDetails();
      return;
    }
    if (isOrgFlow && step === 2) {
      void handleVerifyOtp();
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  async function finish() {
    if (!isOrgFlow) {
      signupEmployee({ name, email, country, language });
      router.push("/employee");
      return;
    }

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

  return (
    <AuthShell>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-initial">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
                  i < step ? "bg-brand text-white" : i === step ? "bg-brand/10 text-brand ring-2 ring-brand" : "bg-slate-100 text-slate-400"
                }`}
              >
                {i < step ? <Check size={12} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 mx-2 ${i < step ? "bg-brand" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>
        <h2 className="text-xl font-semibold text-slate-900">{STEPS[step]}</h2>
        {isOrgFlow && (
          <p className="text-xs text-slate-400 mt-1">This path creates a real account on the SafeIQ API - not a demo persona.</p>
        )}
      </div>

      {apiError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{apiError}</p>}

      {step === 0 && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setRole("organisation")}
            className={`text-left p-4 rounded-xl border-2 transition-colors ${
              role === "organisation" ? "border-brand bg-indigo-50/40" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <Building2 size={20} className="text-brand mb-2" />
            <p className="text-sm font-semibold text-slate-800">Organisation</p>
            <p className="text-xs text-slate-500 mt-1">Set up RAG systems and manage your team&apos;s AI agent access.</p>
          </button>
          <button
            onClick={() => setRole("employee")}
            className={`text-left p-4 rounded-xl border-2 transition-colors ${
              role === "employee" ? "border-brand bg-indigo-50/40" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <UserRound size={20} className="text-brand mb-2" />
            <p className="text-sm font-semibold text-slate-800">Employee</p>
            <p className="text-xs text-slate-500 mt-1">Join an organisation you&apos;ve been invited to via magic link.</p>
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          {role === "organisation" && (
            <>
              <FormRow label="Organisation name">
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Bright Care Homes Ltd" />
              </FormRow>
              <FormRow label="Sector">
                <Select value={sector} onChange={(e) => setSector(e.target.value)}>
                  {SECTORS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </FormRow>
            </>
          )}
          {role === "employee" && (
            <FormRow label="Invite / access code" hint="Sent to you by your organisation via magic link.">
              <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="mg-7f3a9c" />
            </FormRow>
          )}
          <FormRow label="Your full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Carter" />
          </FormRow>
          <FormRow label="Work email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.co.uk" />
          </FormRow>
          {isOrgFlow && (
            <FormRow label="Password" hint="At least 10 characters.">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" />
            </FormRow>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Country">
              <Select value={country} onChange={(e) => setCountry(e.target.value as Country)}>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Language">
              <Select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </FormRow>
          </div>
        </div>
      )}

      {isOrgFlow && step === 2 && (
        <div>
          <div className="flex items-start gap-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs p-3 mb-4">
            <MailCheck size={16} className="shrink-0 mt-0.5" />
            <span>
              We&apos;ve sent a 6-digit code to <strong>{email}</strong>. In this dev environment the backend logs the code to its
              server console (no real email is sent yet) - check the terminal running <code>uvicorn</code>.
            </span>
          </div>
          <FormRow label="Verification code">
            <Input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              maxLength={6}
            />
          </FormRow>
        </div>
      )}

      {step === (isOrgFlow ? 3 : 2) && (
        <div>
          <div className="flex items-start gap-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs p-3 mb-4">
            <ShieldCheck size={16} className="shrink-0 mt-0.5" />
            <span>
              Standard KYC step, same across all our platforms. {isOrgFlow ? "This calls the real backend's KYC endpoint - the provider is still TBC with the client, so the dev backend auto-approves." : "This prototype simulates verification - no documents are actually collected or checked."}
            </span>
          </div>
          <FormRow label="Date of birth">
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </FormRow>
          <FormRow label="Home address">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="14 Aire Street" />
          </FormRow>
          <FormRow label="Postcode">
            <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="LS1 4PR" />
          </FormRow>
          <FormRow label="ID document type">
            <Select value={idType} onChange={(e) => setIdType(e.target.value)}>
              <option>Passport</option>
              <option>Driving licence</option>
              <option>National ID card</option>
            </Select>
          </FormRow>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <Label>Upload {idType.toLowerCase()}</Label>
              <label className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 py-5 cursor-pointer hover:border-brand hover:bg-indigo-50/30 transition-colors">
                <UploadCloud size={18} className="text-slate-400" />
                <span className="text-xs text-slate-500 px-2 text-center">{idFileName || "Click to choose a file"}</span>
                <input type="file" className="hidden" onChange={(e) => setIdFileName(e.target.files?.[0]?.name ?? "id-document.jpg")} />
              </label>
            </div>
            <div>
              <Label>Selfie verification</Label>
              <button
                onClick={() => setSelfieTaken(true)}
                className={`w-full flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-5 transition-colors ${
                  selfieTaken ? "border-emerald-400 bg-emerald-50/50" : "border-slate-300 hover:border-brand hover:bg-indigo-50/30"
                }`}
              >
                {selfieTaken ? <Check size={18} className="text-emerald-600" /> : <Camera size={18} className="text-slate-400" />}
                <span className="text-xs text-slate-500">{selfieTaken ? "Selfie captured" : "Simulate selfie capture"}</span>
              </button>
            </div>
          </div>
          {isOrgFlow && (
            <Button variant={kycStatus === "approved" ? "outline" : "primary"} onClick={handleStartKyc} disabled={busy || kycStatus === "approved"}>
              {busy && kycStatus === "checking" ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Verifying...
                </>
              ) : kycStatus === "approved" ? (
                <>
                  <Check size={14} className="text-emerald-600" /> Identity verified
                </>
              ) : (
                "Start identity verification"
              )}
            </Button>
          )}
        </div>
      )}

      {step === STEPS.length - 1 && (
        <div>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 mb-4 text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-slate-500">Account type</span>
              <span className="font-medium text-slate-800 capitalize">{role}</span>
            </div>
            {role === "organisation" && (
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500">Organisation</span>
                <span className="font-medium text-slate-800">{orgName || "-"}</span>
              </div>
            )}
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-slate-500">Name</span>
              <span className="font-medium text-slate-800">{name || "-"}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-800">{email || "-"}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-slate-500">Country / language</span>
              <span className="font-medium text-slate-800">
                {country} / {language}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-slate-500">Identity check</span>
              <span className="font-medium text-emerald-600">{isOrgFlow ? "Verified via SafeIQ API" : "Simulated - passed"}</span>
            </div>
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            I agree to the SafeIQ terms of service and privacy policy (UK GDPR compliant, data hosted in the UK).
          </label>
        </div>
      )}

      <div className="flex items-center justify-between mt-7">
        <Button variant="ghost" onClick={back} className={step === 0 ? "invisible" : ""}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={!canGoNext || busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Continue"}
          </Button>
        ) : (
          <Button onClick={finish} disabled={!agree || busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Create account"}
          </Button>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-brand font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
