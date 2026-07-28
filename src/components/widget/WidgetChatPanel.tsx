"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Phone, ScreenShare, Send, PhoneOff, Mic, MicOff } from "lucide-react";
import { useApp } from "@/lib/store";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { timeAgo, formatDuration } from "@/lib/format";

function convId(a: string, b: string) {
  return [a, b].sort().join("::");
}

export function WidgetChatPanel() {
  const { currentUser, users, conversations, chatMessages, sendChatMessage } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [call, setCall] = useState<"audio" | "screen" | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!call) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [call]);

  function startCall(kind: "audio" | "screen") {
    setElapsed(0);
    setCall(kind);
  }
  function endCall() {
    setCall(null);
    setElapsed(0);
  }

  const contacts = useMemo(
    () => (currentUser ? users.filter((u) => currentUser.allowedContacts.includes(u.id)) : []),
    [users, currentUser]
  );

  const selectedContact = contacts.find((c) => c.id === selectedId);

  const activeConvId = currentUser && selectedContact ? convId(currentUser.id, selectedContact.id) : null;

  const existingConv = conversations.find(
    (c) => currentUser && selectedContact && c.participantIds.includes(currentUser.id) && c.participantIds.includes(selectedContact.id)
  );
  const effectiveConvId = existingConv?.id ?? activeConvId;

  const messages = useMemo(
    () => (effectiveConvId ? chatMessages.filter((m) => m.conversationId === effectiveConvId).sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1)) : []),
    [chatMessages, effectiveConvId]
  );

  function lastMessageFor(contactId: string) {
    const cid = existingConv?.id ?? convId(currentUser?.id ?? "", contactId);
    const msgs = chatMessages.filter((m) => m.conversationId === cid || m.conversationId === convId(currentUser?.id ?? "", contactId));
    return msgs[msgs.length - 1];
  }

  function send() {
    if (!draft.trim() || !currentUser || !effectiveConvId) return;
    sendChatMessage(effectiveConvId, currentUser.id, draft.trim());
    setDraft("");
  }

  if (!currentUser) return null;

  if (call && selectedContact) {
    return (
      <div className="flex flex-col items-center justify-between h-full bg-slate-900 text-white p-6">
        <div className="text-center mt-6">
          <p className="text-xs text-slate-400 mb-1">{call === "audio" ? "Voice call (simulated)" : "Screen share (simulated)"}</p>
          <p className="text-sm font-medium">{formatDuration(elapsed)}</p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Avatar name={selectedContact.name} color={selectedContact.avatarColor} size={72} />
          <p className="font-medium">{selectedContact.name}</p>
          <p className="text-xs text-slate-400">{call === "screen" ? "Viewing shared screen..." : "Connected"}</p>
          {call === "screen" && (
            <div className="w-full aspect-video rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-xs mt-2">
              Simulated screen share preview
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setMuted((m) => !m)}
            className={`w-11 h-11 rounded-full flex items-center justify-center ${muted ? "bg-white text-slate-900" : "bg-white/10 text-white"}`}
          >
            {muted ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
          <button onClick={endCall} className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center">
            <PhoneOff size={19} />
          </button>
        </div>
      </div>
    );
  }

  if (selectedContact) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
          <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-700 p-1">
            <ArrowLeft size={16} />
          </button>
          <Avatar name={selectedContact.name} color={selectedContact.avatarColor} size={28} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 truncate">{selectedContact.name}</p>
            <p className="text-[11px] text-slate-400 truncate">{selectedContact.jobTitle}</p>
          </div>
          <button onClick={() => startCall("audio")} className="text-slate-400 hover:text-brand p-1.5 hover:bg-indigo-50 rounded-full">
            <Phone size={16} />
          </button>
          <button onClick={() => startCall("screen")} className="text-slate-400 hover:text-brand p-1.5 hover:bg-indigo-50 rounded-full">
            <ScreenShare size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No messages yet - say hello.</p>}
          {messages.map((m) => {
            const mine = m.senderId === currentUser.id;
            return (
              <div key={m.id} className={mine ? "ml-auto max-w-[80%]" : "mr-auto max-w-[80%]"}>
                <div className={`text-xs rounded-2xl px-3 py-2 w-fit ${mine ? "bg-brand text-white rounded-tr-sm ml-auto" : "bg-slate-100 text-slate-700 rounded-tl-sm"}`}>
                  {m.text}
                </div>
                <p className={`text-[10px] text-slate-400 mt-0.5 ${mine ? "text-right" : ""}`}>{timeAgo(m.sentAt)}</p>
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t border-slate-100 flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message..." className="text-sm" />
          <Button onClick={send}>
            <Send size={15} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 overflow-y-auto h-full">
      {contacts.length === 0 && <p className="text-xs text-slate-400 text-center py-8 px-3">Your organisation hasn&apos;t given you access to any contacts yet.</p>}
      {contacts.map((c) => {
        const last = lastMessageFor(c.id);
        return (
          <button key={c.id} onClick={() => setSelectedId(c.id)} className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2.5 hover:bg-slate-50 text-left">
            <Avatar name={c.name} color={c.avatarColor} size={34} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
              <p className="text-xs text-slate-400 truncate">{last ? last.text : c.jobTitle}</p>
            </div>
            {last && <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(last.sentAt)}</span>}
          </button>
        );
      })}
    </div>
  );
}
