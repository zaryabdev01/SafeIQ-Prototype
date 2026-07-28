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
import { Building2, UserRound, Check, UploadCloud, Camera, ShieldCheck } from "lucide-react";

const STEPS = ["Account type", "Your details", "Identity check", "Review"];

export default function SignupPage() {
  const router = useRouter();
  const { signupOrganisation, signupEmployee } = useApp();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>("organisation");

  const [orgName, setOrgName] = useState("");
  const [sector, setSector] = useState(SECTORS[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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

  const canGoNext =
    (step === 0 && role) ||
    (step === 1 && name && email && (role === "employee" || orgName)) ||
    (step === 2 && dob && address && postcode && idFileName && selfieTaken) ||
    step === 3;

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
  }
  function back() {
    if (step > 0) setStep(step - 1);
  }

  function finish() {
    if (role === "organisation") {
      signupOrganisation({ orgName, sector, name, email, country, language });
      router.push("/dashboard");
    } else {
      signupEmployee({ name, email, country, language });
      router.push("/employee");
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
      </div>

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

      {step === 2 && (
        <div>
          <div className="flex items-start gap-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs p-3 mb-4">
            <ShieldCheck size={16} className="shrink-0 mt-0.5" />
            <span>Standard KYC step, same across all our platforms. This prototype simulates verification - no documents are actually collected or checked.</span>
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
          <div className="grid grid-cols-2 gap-3">
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
        </div>
      )}

      {step === 3 && (
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
              <span className="font-medium text-emerald-600">Simulated - passed</span>
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
          <Button onClick={next} disabled={!canGoNext}>
            Continue
          </Button>
        ) : (
          <Button onClick={finish} disabled={!agree}>
            Create account
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
