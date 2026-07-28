import Link from "next/link";
import { ShieldCheck, MessageCircleMore, FolderLock, Radio } from "lucide-react";

const points = [
  { icon: FolderLock, text: "Give each AI agent its own isolated RAG - no cross-contamination between clients." },
  { icon: MessageCircleMore, text: "A floating AI agent your team can carry between the platform and any website." },
  { icon: Radio, text: "Live question monitoring, category-based alerts, and full activity audit trails." },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 text-white p-12 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -left-16 bottom-0 w-72 h-72 rounded-full bg-white/5" />
        <Link href="/" className="flex items-center gap-2 relative z-10">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur">
            <ShieldCheck size={20} />
          </div>
          <span className="font-semibold text-lg tracking-tight">SafeIQ</span>
        </Link>

        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight mb-6">
            One AI agent. Every RAG your organisation trusts.
          </h1>
          <ul className="space-y-4">
            {points.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-indigo-100 text-sm">
                <p.icon size={18} className="mt-0.5 shrink-0 text-indigo-300" />
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-indigo-300">Prototype build - all data on this screen is simulated for demonstration.</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10 bg-slate-50">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
