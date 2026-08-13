"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Phone, ScreenShare, Send, PhoneOff, Mic, MicOff, Video, Users, UsersRound, Plus } from "lucide-react";
import { useApp } from "@/lib/store";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { timeAgo, formatDuration } from "@/lib/format";

function convId(a: string, b: string) {
  return [a, b].sort().join("::");
}

type Selection = { kind: "contact" | "group"; id: string };
type CallKind = "audio" | "screen" | "video";

export function WidgetChatPanel() {
  const { currentUser, users, conversations, chatMessages, sendChatMessage, createGroupConversation } = useApp();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState("");
  const [call, setCall] = useState<CallKind | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (!call) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [call]);

  function startCall(kind: CallKind) {
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
  const myGroups = useMemo(
    () => (currentUser ? conversations.filter((c) => c.isGroup && c.participantIds.includes(currentUser.id)) : []),
    [conversations, currentUser]
  );

  const selectedContact = selection?.kind === "contact" ? contacts.find((c) => c.id === selection.id) : undefined;
  const selectedGroup = selection?.kind === "group" ? myGroups.find((g) => g.id === selection.id) : undefined;

  const existingConv =
    selection?.kind === "contact" && currentUser && selectedContact
      ? conversations.find((c) => c.participantIds.includes(currentUser.id) && c.participantIds.includes(selectedContact.id) && !c.isGroup)
      : undefined;
  const effectiveConvId =
    selection?.kind === "group"
      ? selection.id
      : selection?.kind === "contact" && currentUser && selectedContact
        ? existingConv?.id ?? convId(currentUser.id, selectedContact.id)
        : null;

  const messages = useMemo(
    () => (effectiveConvId ? chatMessages.filter((m) => m.conversationId === effectiveConvId).sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1)) : []),
    [chatMessages, effectiveConvId]
  );

  function lastMessageFor(convId: string) {
    const msgs = chatMessages.filter((m) => m.conversationId === convId);
    return msgs[msgs.length - 1];
  }
  function lastMessageForContact(contactId: string) {
    if (!currentUser) return undefined;
    const existing = conversations.find((c) => c.participantIds.includes(currentUser.id) && c.participantIds.includes(contactId) && !c.isGroup);
    const cid = existing?.id ?? convId(currentUser.id, contactId);
    return lastMessageFor(cid);
  }

  function send() {
    if (!draft.trim() || !currentUser || !effectiveConvId) return;
    sendChatMessage(effectiveConvId, currentUser.id, draft.trim());
    setDraft("");
  }

  function toggleGroupMember(id: string) {
    setGroupMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function submitGroup() {
    if (!currentUser || !groupName.trim() || groupMemberIds.length === 0) return;
    const newId = createGroupConversation(groupName.trim(), groupMemberIds, currentUser.id);
    setCreatingGroup(false);
    setGroupName("");
    setGroupMemberIds([]);
    setSelection({ kind: "group", id: newId });
  }

  if (!currentUser) return null;

  const headerName = selection?.kind === "group" ? selectedGroup?.label : selectedContact?.name;
  const headerSubtitle =
    selection?.kind === "group" ? `${selectedGroup?.participantIds.length ?? 0} members` : selectedContact?.jobTitle;

  if (call && (selectedContact || selectedGroup)) {
    return (
      <div className="flex flex-col items-center justify-between h-full bg-slate-900 text-white p-6">
        <div className="text-center mt-6">
          <p className="text-xs text-slate-400 mb-1">
            {call === "audio" ? "Voice call" : call === "video" ? "Video call" : "Screen share"} (simulated)
          </p>
          <p className="text-sm font-medium">{formatDuration(elapsed)}</p>
        </div>
        <div className="flex flex-col items-center gap-3">
          {selectedGroup ? (
            <div className="flex -space-x-3">
              {selectedGroup.participantIds.slice(0, 4).map((id) => {
                const u = users.find((x) => x.id === id);
                return u ? <Avatar key={id} name={u.name} color={u.avatarColor} size={56} /> : null;
              })}
            </div>
          ) : (
            <Avatar name={selectedContact!.name} color={selectedContact!.avatarColor} size={72} />
          )}
          <p className="font-medium">{headerName}</p>
          <p className="text-xs text-slate-400">{call === "screen" ? "Viewing shared screen..." : "Connected"}</p>
          {(call === "screen" || call === "video") && (
            <div className="w-full aspect-video rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-xs mt-2">
              {call === "video" ? "Simulated video preview" : "Simulated screen share preview"}
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

  if (selection && (selectedContact || selectedGroup)) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
          <button onClick={() => setSelection(null)} className="text-slate-400 hover:text-slate-700 p-1">
            <ArrowLeft size={16} />
          </button>
          {selectedGroup ? (
            <div className="w-7 h-7 rounded-full bg-indigo-100 text-brand flex items-center justify-center shrink-0">
              <UsersRound size={14} />
            </div>
          ) : (
            <Avatar name={selectedContact!.name} color={selectedContact!.avatarColor} size={28} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 truncate">{headerName}</p>
            <p className="text-[11px] text-slate-400 truncate">{headerSubtitle}</p>
          </div>
          <button onClick={() => startCall("audio")} className="text-slate-400 hover:text-brand p-1.5 hover:bg-indigo-50 rounded-full">
            <Phone size={16} />
          </button>
          <button onClick={() => startCall("video")} className="text-slate-400 hover:text-brand p-1.5 hover:bg-indigo-50 rounded-full">
            <Video size={16} />
          </button>
          <button onClick={() => startCall("screen")} className="text-slate-400 hover:text-brand p-1.5 hover:bg-indigo-50 rounded-full">
            <ScreenShare size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No messages yet - say hello.</p>}
          {messages.map((m) => {
            const mine = m.senderId === currentUser.id;
            const sender = users.find((u) => u.id === m.senderId);
            return (
              <div key={m.id} className={mine ? "ml-auto max-w-[80%]" : "mr-auto max-w-[80%]"}>
                {selectedGroup && !mine && <p className="text-[10px] text-slate-400 mb-0.5">{sender?.name}</p>}
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

  if (creatingGroup) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
          <button onClick={() => setCreatingGroup(false)} className="text-slate-400 hover:text-slate-700 p-1">
            <ArrowLeft size={16} />
          </button>
          <p className="text-sm font-medium text-slate-800">New group</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="text-sm" />
          <div className="space-y-1">
            {contacts.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={groupMemberIds.includes(c.id)} onChange={() => toggleGroupMember(c.id)} className="rounded" />
                <Avatar name={c.name} color={c.avatarColor} size={28} />
                <span className="text-sm text-slate-700">{c.name}</span>
              </label>
            ))}
            {contacts.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No contacts available to add.</p>}
          </div>
        </div>
        <div className="p-3 border-t border-slate-100">
          <Button className="w-full" onClick={submitGroup} disabled={!groupName.trim() || groupMemberIds.length === 0}>
            Create group
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 overflow-y-auto h-full">
      <button
        onClick={() => setCreatingGroup(true)}
        className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2.5 hover:bg-slate-50 text-left text-brand"
      >
        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
          <Plus size={15} />
        </div>
        <span className="text-sm font-medium">New group</span>
      </button>

      {myGroups.length > 0 && (
        <>
          <p className="px-2 pt-2 pb-1 text-[11px] font-medium text-slate-400 uppercase tracking-wide">Groups</p>
          {myGroups.map((g) => {
            const last = lastMessageFor(g.id);
            return (
              <button key={g.id} onClick={() => setSelection({ kind: "group", id: g.id })} className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2.5 hover:bg-slate-50 text-left">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-brand flex items-center justify-center shrink-0">
                  <Users size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{g.label}</p>
                  <p className="text-xs text-slate-400 truncate">{last ? last.text : `${g.participantIds.length} members`}</p>
                </div>
                {last && <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(last.sentAt)}</span>}
              </button>
            );
          })}
        </>
      )}

      <p className="px-2 pt-2 pb-1 text-[11px] font-medium text-slate-400 uppercase tracking-wide">Direct</p>
      {contacts.length === 0 && <p className="text-xs text-slate-400 text-center py-8 px-3">Your organisation hasn&apos;t given you access to any contacts yet.</p>}
      {contacts.map((c) => {
        const last = lastMessageForContact(c.id);
        return (
          <button key={c.id} onClick={() => setSelection({ kind: "contact", id: c.id })} className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2.5 hover:bg-slate-50 text-left">
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
