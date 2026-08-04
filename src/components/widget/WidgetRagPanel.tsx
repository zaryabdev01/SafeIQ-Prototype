"use client";

import { useMemo, useState } from "react";
import { BrainCircuit, Check, Lock, Send, Loader2, Mic, MicOff, Volume2, Flag } from "lucide-react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { timeAgo } from "@/lib/format";

export function WidgetRagPanel() {
  const { currentUser, rags, ragAssignments, ragQuestions, activeRagByUser, setActiveRagForUser, askRag, flagQuestionAsAlert } = useApp();
  const [codeInputFor, setCodeInputFor] = useState<string | null>(null);
  const [codeValue, setCodeValue] = useState("");
  const [codeError, setCodeError] = useState("");
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  const myAssignments = useMemo(
    () => (currentUser ? ragAssignments.filter((a) => a.userId === currentUser.id) : []),
    [ragAssignments, currentUser]
  );
  const activeRagId = currentUser ? activeRagByUser[currentUser.id] ?? null : null;
  const activeRag = rags.find((r) => r.id === activeRagId) ?? null;
  const activeAssignment = myAssignments.find((a) => a.ragId === activeRagId);

  const history = useMemo(
    () =>
      currentUser && activeRagId
        ? ragQuestions.filter((q) => q.ragId === activeRagId && q.userId === currentUser.id).sort((a, b) => (a.askedAt < b.askedAt ? 1 : -1))
        : [],
    [ragQuestions, activeRagId, currentUser]
  );

  function activate(ragId: string) {
    const assignment = myAssignments.find((a) => a.ragId === ragId);
    if (!assignment) return;
    if (codeValue.trim().toUpperCase() === assignment.accessCode.toUpperCase()) {
      setActiveRagForUser(currentUser!.id, ragId);
      setCodeInputFor(null);
      setCodeValue("");
      setCodeError("");
    } else {
      setCodeError("That access code doesn't match this RAG.");
    }
  }

  function submitQuestion() {
    if (!question.trim() || !currentUser || !activeRagId) return;
    setThinking(true);
    setTimeout(() => {
      askRag(activeRagId, currentUser.id, question.trim(), voiceMode);
      setQuestion("");
      setThinking(false);
    }, 550);
  }

  function flagAnswer(questionId: string) {
    if (!currentUser) return;
    flagQuestionAsAlert(questionId, currentUser.id);
    setFlagged((prev) => new Set(prev).add(questionId));
  }

  if (!currentUser) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-slate-100 space-y-2 overflow-y-auto max-h-40">
        {myAssignments.length === 0 && <p className="text-xs text-slate-400 px-1 py-2">No RAGs assigned to you yet.</p>}
        {myAssignments.map((a) => {
          const rag = rags.find((r) => r.id === a.ragId);
          if (!rag) return null;
          const isActive = activeRagId === rag.id;
          return (
            <div key={rag.id} className="rounded-lg border border-slate-200 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rag.colorTag }} />
                  <p className="text-sm font-medium text-slate-800 truncate">{rag.name}</p>
                </div>
                {isActive ? (
                  <Badge tone="green">
                    <Check size={11} /> Active
                  </Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setCodeInputFor(codeInputFor === rag.id ? null : rag.id)}>
                    <Lock size={12} /> Switch on
                  </Button>
                )}
              </div>
              {codeInputFor === rag.id && !isActive && (
                <div className="mt-2 flex gap-1.5">
                  <Input
                    value={codeValue}
                    onChange={(e) => setCodeValue(e.target.value)}
                    placeholder="Enter access code"
                    className="text-xs py-1.5"
                  />
                  <Button size="sm" onClick={() => activate(rag.id)}>
                    Go
                  </Button>
                </div>
              )}
              {codeInputFor === rag.id && codeError && <p className="text-[11px] text-red-600 mt-1">{codeError}</p>}
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!activeRag && <p className="text-xs text-slate-400 text-center py-6">Switch on a RAG above to start asking it questions.</p>}
        {activeRag && (
          <>
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-2.5 py-2">
              <BrainCircuit size={14} className="text-brand" />
              Asking <span className="font-medium text-slate-700">{activeRag.name}</span>
              {activeAssignment && <span className="ml-auto font-mono text-[10px] text-slate-400">{activeAssignment.accessCode}</span>}
            </div>
            {history.map((q) => (
              <div key={q.id} className="space-y-1">
                <div className="ml-auto max-w-[85%] bg-brand text-white text-xs rounded-2xl rounded-tr-sm px-3 py-2 w-fit flex items-center gap-1.5">
                  {q.askedViaVoice && <Mic size={10} className="text-indigo-200 shrink-0" />}
                  {q.text}
                </div>
                {q.status === "answered" && q.answer && (
                  <div className="mr-auto max-w-[85%] space-y-1">
                    <div className="bg-slate-100 text-slate-700 text-xs rounded-2xl rounded-tl-sm px-3 py-2 w-fit flex items-start gap-1.5">
                      {voiceMode && <Volume2 size={11} className="text-slate-400 shrink-0 mt-0.5" />}
                      <span>{q.answer}</span>
                    </div>
                    <button
                      onClick={() => flagAnswer(q.id)}
                      disabled={flagged.has(q.id)}
                      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-600 disabled:text-emerald-600 disabled:cursor-default"
                    >
                      <Flag size={10} /> {flagged.has(q.id) ? "Flagged for review" : "Flag this answer"}
                    </button>
                  </div>
                )}
                {q.status !== "answered" && (
                  <div className="mr-auto max-w-[85%] bg-amber-50 text-amber-700 text-xs rounded-2xl rounded-tl-sm px-3 py-2 w-fit">
                    Not in this RAG yet - sent to your organisation to answer.
                  </div>
                )}
                <p className="text-[10px] text-slate-400">{timeAgo(q.askedAt)}</p>
              </div>
            ))}
          </>
        )}
      </div>

      {activeRag && (
        <div className="p-3 border-t border-slate-100 flex gap-2">
          <button
            onClick={() => setVoiceMode((v) => !v)}
            title={voiceMode ? "Voice mode on - speak, agent replies aloud" : "Switch to voice mode"}
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              voiceMode ? "bg-brand text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {voiceMode ? <Mic size={15} /> : <MicOff size={15} />}
          </button>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitQuestion()}
            placeholder={voiceMode ? "Voice mode on - type to simulate speaking..." : "Ask this RAG a question..."}
            className="text-sm"
          />
          <Button onClick={submitQuestion} disabled={thinking}>
            {thinking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </Button>
        </div>
      )}
    </div>
  );
}
