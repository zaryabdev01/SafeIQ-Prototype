import { Shield, Layers, BarChart3 } from "lucide-react";
import { WordmarkLogo } from "@/components/auth/WordmarkLogo";
import { AuthPanelBlob } from "@/components/auth/AuthPanelBlob";

const loginFeatures = [
  {
    icon: Shield,
    title: "Isolated & Secure",
    description: "Each AI agent runs in its own isolated RAG — no cross-contamination between clients.",
  },
  {
    icon: Layers,
    title: "Carry Knowledge Everywhere",
    description: "Your team can access trusted context across platforms, tools, and websites.",
  },
  {
    icon: BarChart3,
    title: "Observe & Improve",
    description: "Live monitoring, category alerts, and audit trails keep you in control.",
  },
];

const signupPoints = [
  "Give each AI agent its own isolated RAG – no cross-contamination between clients.",
  "A floating AI agent your team can carry between the platform and any website.",
  "Live question monitoring, category-based alerts, and full activity audit trails.",
];

function LoginMarketingContent() {
  return (
    <div className="mt-14 flex max-w-[520px] flex-col gap-8 xl:mt-16 xl:gap-9">
      <span className="inline-flex w-fit items-center rounded-full border border-white/25 px-4 py-1.5 text-[11px] font-bold tracking-[0.14em] text-white/85">
        AI AGENT PLATFORM
      </span>

      <h1 className="text-[44px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white xl:text-[56px]">
        Every RAG your
        <br />
        organization trusts.
      </h1>

      <p className="max-w-[460px] text-[15px] leading-[1.65] tracking-[-0.01em] text-[#a39cb5] xl:text-base">
        Safe IQ is your secure AI agent and RAG platform built for organisations that value accuracy, privacy,
        and performance.
      </p>

      <div className="h-px w-12 bg-[#6b4fc4]/80" />

      <div className="flex flex-col gap-7">
        {loginFeatures.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-white/10 bg-gradient-to-br from-[#5a3fa8] to-[#2a1858] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
              <Icon size={20} className="text-white/90" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col gap-1 pt-0.5">
              <h3 className="text-[15px] font-bold tracking-[-0.02em] text-white">{title}</h3>
              <p className="text-sm leading-[1.55] text-[#a39cb5]">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignupMarketingContent() {
  return (
    <div className="mt-14 flex max-w-lg flex-col gap-6 xl:mt-[70px] xl:gap-[70px]">
      <div className="flex flex-col gap-6">
        <span className="inline-flex w-fit items-center rounded-[20px] border-2 border-white/20 px-5 py-2 text-base font-bold tracking-[-0.02em] text-white/80">
          One AI agent
        </span>

        <h1 className="text-[48px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white xl:text-[56px]">
          Every RAG your organization trusts.
        </h1>
      </div>

      <ul className="flex flex-col gap-3 pl-5">
        {signupPoints.map((point) => (
          <li
            key={point}
            className="list-disc text-base font-bold leading-[1.4] tracking-[-0.02em] text-white/80 marker:text-white/80"
          >
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Split-screen shell for the pre-login auth screens: dark marketing panel on the
 * left, white form column on the right.
 */
export function AuthShell({
  children,
  footer,
  panel = "login",
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Marketing panel layout — login uses feature cards; signup uses bullet list. */
  panel?: "login" | "signup";
}) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-[811fr_629fr]">
      {/* Marketing panel */}
      <div
        className="auth-marketing-panel relative hidden overflow-hidden lg:flex lg:flex-col"
        style={{ backgroundColor: "var(--auth-panel-bg)" }}
      >
        <AuthPanelBlob />

        <div className="relative z-10 flex h-full flex-col px-10 py-12 xl:px-12 xl:py-14">
          <WordmarkLogo tone="light" />

          {panel === "signup" ? <SignupMarketingContent /> : <LoginMarketingContent />}


        </div>
      </div>

      {/* Form column */}
      <div className="flex min-h-screen flex-col items-center justify-between gap-8 bg-white px-6 py-10 sm:px-12 lg:px-16">
        <WordmarkLogo tone="dark" className="shrink-0" />
        <div className="flex w-full max-w-[480px] flex-1 flex-col items-center justify-center">{children}</div>
        <div className="flex min-h-[24px] shrink-0 items-center justify-center text-[13.5px]">{footer}</div>
      </div>
    </div>
  );
}
