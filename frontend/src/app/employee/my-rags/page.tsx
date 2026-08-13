"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import { BrainCircuit, Key, Check, Send, Loader2 } from "lucide-react";

export default function MyRagsPage() {
  const { currentUser, rags, ragAssignments, ragQuestions, activeRagByUser, setActiveRagForUser, askRag } = useApp();
  const [question, setQuestion] = useState<Record<string, string>>({});
  const [thinking, setThinking] = useState<string | null>(null);

  const myAssignments = useMemo(() => (currentUser ? ragAssignments.filter((a) => a.userId === currentUser.id) : []), [ragAssignments, currentUser]);

  if (!currentUser) return null;
  const activeRagId = activeRagByUser[currentUser.id] ?? null;

  function submit(ragId: string) {
    if (!currentUser) return;
    const text = question[ragId]?.trim();
    if (!text) return;
    const userId = currentUser.id;
    setThinking(ragId);
    window.setTimeout(() => {
      askRag(ragId, userId, text);
      setQuestion((q) => ({ ...q, [ragId]: "" }));
      setThinking(null);
    }, 500);
  }

  return (
    <AppShell title="My RAGs" subtitle="Everything you've been assigned access to">
      <div className="space-y-5">
        {myAssignments.map((a) => {
          const rag = rags.find((r) => r.id === a.ragId);
          if (!rag) return null;
          const isActive = activeRagId === rag.id;
          const history = ragQuestions
            .filter((q) => q.ragId === rag.id && q.userId === currentUser.id)
            .sort((x, y) => (x.askedAt < y.askedAt ? 1 : -1));

          return (
            <Card key={rag.id}>
              <CardBody>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${rag.colorTag}1a`, color: rag.colorTag }}>
                    <BrainCircuit size={19} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{rag.name}</p>
                    <Badge tone="slate" className="mt-1">
                      <Key size={11} /> {a.accessCode}
                    </Badge>
                  </div>
                  {isActive ? (
                    <Badge tone="green">
                      <Check size={12} /> Active in agent
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setActiveRagForUser(currentUser.id, rag.id)}>
                      Switch on
                    </Button>
                  )}
                </div>

                {isActive && (
                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex gap-2 mb-3">
                      <Input
                        value={question[rag.id] ?? ""}
                        onChange={(e) => setQuestion((q) => ({ ...q, [rag.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && submit(rag.id)}
                        placeholder="Ask this RAG a question..."
                        className="text-sm flex-1"
                      />
                      <Button onClick={() => submit(rag.id)} disabled={thinking === rag.id}>
                        {thinking === rag.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {history.map((q) => (
                        <div key={q.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2.5">
                          <p className="text-slate-700 font-medium">{q.text}</p>
                          <p className="text-slate-500 mt-1">{q.answer ?? "Not in this RAG yet - sent to your organisation to answer."}</p>
                          <p className="text-slate-400 mt-1">{timeAgo(q.askedAt)}</p>
                        </div>
                      ))}
                      {history.length === 0 && <p className="text-xs text-slate-400 py-2">No questions asked yet.</p>}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
        {myAssignments.length === 0 && (
          <Card>
            <CardBody className="text-center py-12 text-sm text-slate-400">No RAGs assigned to you yet.</CardBody>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
