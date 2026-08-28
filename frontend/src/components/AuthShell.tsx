import { WordmarkLogo } from "@/components/auth/WordmarkLogo";

const points = [
  "Give each AI agent its own isolated RAG - no cross-contamination between clients.",
  "A floating AI agent your team can carry between the platform and any website.",
  "Live question monitoring, category-based alerts, and full activity audit trails.",
];

/**
 * Split-screen shell for the pre-login auth screens, rebuilt to the production
 * Figma design (2026-08): dark marketing panel on the left, white form column on
 * the right. The right column is a top/middle/bottom stack — brand wordmark,
 * the page's card, then an optional footer line.
 */
export function AuthShell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-[811fr_629fr]">
      {/* Marketing panel */}
      <div
        className="relative hidden overflow-hidden px-10 py-20 lg:flex lg:flex-col lg:gap-[70px]"
        style={{ backgroundColor: "var(--auth-panel-bg)" }}
      >
        {/* soft violet depth glow (lower-right), echoing the Figma 3D shape */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 55% at 78% 78%, rgba(139,108,214,0.55) 0%, rgba(90,63,168,0.28) 38%, rgba(20,11,61,0) 70%), radial-gradient(40% 40% at 92% 96%, rgba(120,96,200,0.45) 0%, rgba(20,11,61,0) 65%)",
          }}
        />
        {/* faint brand texture, top-left */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-[220px] w-[520px] opacity-[0.06]"
          style={{
            backgroundImage: "url(/auth/panel-texture.png)",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "top left",
            backgroundSize: "420px auto",
          }}
        />

        <div className="relative z-10">
          <WordmarkLogo tone="light" />
        </div>

        <div className="relative z-10 flex max-w-lg flex-col gap-6">
          <span className="inline-flex w-fit items-center rounded-[20px] border-2 border-white/20 px-5 py-2 text-base font-bold tracking-[-0.02em] text-white/80">
            One AI agent
          </span>
          <h1 className="text-[56px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white xl:text-[64px]">
            Every RAG your organization trusts.
          </h1>
          <ul className="flex flex-col gap-3 pl-5">
            {points.map((p, i) => (
              <li key={i} className="list-disc text-base font-bold leading-[1.4] tracking-[-0.02em] text-white/80">
                {p}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 mt-auto text-xs text-white/40">
          Prototype build - data on these screens is simulated for demonstration.
        </p>
      </div>

      {/* Form column */}
      <div className="flex flex-col items-center justify-between gap-8 bg-white px-6 py-10 sm:px-16">
        <WordmarkLogo tone="dark" />
        <div className="flex w-full flex-1 flex-col items-center justify-center">{children}</div>
        <div className="flex min-h-[24px] items-center justify-center text-[13.5px]">{footer}</div>
      </div>
    </div>
  );
}
