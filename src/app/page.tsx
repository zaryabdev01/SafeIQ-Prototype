import Link from "next/link";
import {
  ShieldCheck,
  BrainCircuit,
  Users,
  MessagesSquare,
  CalendarDays,
  Siren,
  Smartphone,
  Lock,
  ArrowRight,
} from "lucide-react";

const features = [
  { icon: BrainCircuit, title: "Isolated RAG systems", desc: "Create as many AI agents as you like, each with its own private, drag-and-drop RAG. AI organises content automatically." },
  { icon: MessagesSquare, title: "One floating AI agent", desc: "Sits at the bottom-right of the platform, or floats on top of any website your team is using." },
  { icon: Users, title: "Team & access control", desc: "Magic-link invites, per-person access codes, notes, and custom alert rules for every person you manage." },
  { icon: CalendarDays, title: "Calendar & bookings", desc: "Book time with your team, linked directly to a RAG and its access code." },
  { icon: Siren, title: "Built-in safety tools", desc: "Lock-screen recording, live transcription, a siren/police alert, and a voice safe word." },
  { icon: Lock, title: "UK data & compliance", desc: "AWS UK hosting, encryption at rest, per-organisation isolation, versioned documents, and full audit trails." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
            <ShieldCheck size={17} className="text-white" />
          </div>
          <span className="font-semibold text-slate-900 tracking-tight">SafeIQ</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Sign in
          </Link>
          <Link href="/signup" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">
            Get started
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand bg-indigo-50 rounded-full px-3 py-1 mb-5">
          <ShieldCheck size={12} /> Prototype build for client orientation
        </span>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 mb-5">
          A floating AI agent, backed by RAG systems only your organisation controls.
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-8">
          Drop your documents in, deploy an AI agent that answers strictly from your own content, and give every
          employee an assigned, access-code protected RAG they can switch between - all from one live chat widget.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/signup" className="inline-flex items-center gap-2 bg-brand text-white px-5 py-3 rounded-lg font-medium hover:bg-brand-dark">
            Create your organisation <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-lg font-medium hover:bg-slate-50">
            Explore the demo
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-brand flex items-center justify-center mb-3">
                <f.icon size={19} />
              </div>
              <p className="text-sm font-semibold text-slate-900 mb-1.5">{f.title}</p>
              <p className="text-sm text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-8 sm:p-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mb-4">
              <Smartphone size={21} />
            </div>
            <h2 className="text-2xl font-semibold mb-3">The agent goes wherever your team does</h2>
            <p className="text-slate-300 text-sm">
              The same floating agent widget used across this platform is designed to run as a lightweight overlay on
              iOS and Android - a small always-on-top bubble your team can carry to any app on their device. This
              prototype demonstrates that experience in a responsive, touch-friendly web view so it can be reviewed
              on any device today, ahead of native app builds.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-center">
            <div className="w-40 h-72 rounded-[28px] border-4 border-white/20 relative bg-slate-800/60 flex items-end justify-end p-3">
              <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center shadow-lg">
                <MessagesSquare size={17} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 pb-10 text-xs text-slate-400 text-center">
        SafeIQ prototype - all data shown is simulated for demonstration purposes.
      </footer>
    </div>
  );
}
