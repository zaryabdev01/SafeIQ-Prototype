"use client";

import { useState } from "react";
import { AlertTriangle, Mic, Siren, KeyRound, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export function WidgetSafetyPanel() {
  const [recording, setRecording] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [safeWord, setSafeWord] = useState("nightingale");
  const [flash, setFlash] = useState<string | null>(null);
  const [sirenActive, setSirenActive] = useState(false);

  function showFlash(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 3200);
  }

  function triggerSiren() {
    setSirenActive(true);
    showFlash("Simulated: siren sounded, organisation and emergency contacts alerted. No real call was placed.");
    window.setTimeout(() => setSirenActive(false), 2500);
  }

  function testSafeWord() {
    showFlash(`Simulated: safe word "${safeWord}" detected 3x - organisation and police contact would be alerted. No real call was placed.`);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 text-amber-800 text-xs p-3">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
        <span>Prototype only - none of these controls contact real emergency services. This panel demonstrates the intended UX.</span>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <Mic size={15} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">Record while locked</p>
            <p className="text-[11px] text-slate-500">Keeps audio recording if the device is locked</p>
          </div>
        </div>
        <button
          onClick={() => {
            setRecording((r) => !r);
            showFlash(!recording ? "Simulated: lock-screen audio recording started." : "Simulated: recording stopped.");
          }}
          className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${recording ? "bg-brand" : "bg-slate-200"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${recording ? "left-[18px]" : "left-0.5"}`} />
        </button>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <Volume2 size={15} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">Read messages aloud</p>
            <p className="text-[11px] text-slate-500">Agent reads incoming messages, transcribes audio replies</p>
          </div>
        </div>
        <button
          onClick={() => setReadAloud((r) => !r)}
          className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${readAloud ? "bg-brand" : "bg-slate-200"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${readAloud ? "left-[18px]" : "left-0.5"}`} />
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <KeyRound size={15} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">Voice safe word</p>
            <p className="text-[11px] text-slate-500">Said 3x, alerts police & organisation (simulated)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input value={safeWord} onChange={(e) => setSafeWord(e.target.value)} className="flex-1" />
          <Button size="sm" variant="outline" onClick={testSafeWord}>
            Test
          </Button>
        </div>
      </div>

      <button
        onClick={triggerSiren}
        className={`w-full flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-colors ${
          sirenActive ? "bg-red-700 animate-pulse-ring" : "bg-red-600 hover:bg-red-700"
        }`}
      >
        <Siren size={16} />
        {sirenActive ? "Alert triggered (simulated)" : "Sound alert & notify police"}
      </button>

      {flash && (
        <div className="rounded-lg bg-slate-900 text-white text-xs px-3 py-2.5 animate-fade-in">{flash}</div>
      )}
    </div>
  );
}
