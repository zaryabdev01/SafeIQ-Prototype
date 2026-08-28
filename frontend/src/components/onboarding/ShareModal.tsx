"use client";

import { useState } from "react";
import { Mail, MessageCircle, MessagesSquare, Bell, Users, Building2, MapPin, Share2, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AuthInput, AuthSelect } from "@/components/auth/AuthField";
import type { ShareChannel } from "@/lib/types";

const ALL_TARGETS: { key: ShareChannel; label: string; icon: LucideIcon }[] = [
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "messenger", label: "Messenger", icon: MessagesSquare },
  { key: "inplatform", label: "In Platform", icon: Bell },
  { key: "team", label: "Team", icon: Users },
  { key: "department", label: "Department", icon: Building2 },
  { key: "location", label: "Location", icon: MapPin },
];

const USER_CHANNELS: ShareChannel[] = ["whatsapp", "messenger", "inplatform"];
const GROUP_CHANNELS: ShareChannel[] = ["team", "department", "location"];

/**
 * Multi-channel "Share" modal from the M3 Figma: a grid of target tiles, a
 * contextual field per target, a message box and a Share button. Emits a
 * normalised `{ channel, target, message }` so both onboarding branches can
 * adapt it to their own handler.
 */
export function ShareModal({
  open,
  onClose,
  videoTitle,
  channels = ALL_TARGETS.map((t) => t.key),
  users = [],
  groups = {},
  onShare,
}: {
  open: boolean;
  onClose: () => void;
  videoTitle: string;
  channels?: ShareChannel[];
  users?: { id: string; name: string; email?: string }[];
  groups?: Partial<Record<"team" | "department" | "location", string[]>>;
  onShare: (payload: { channel: ShareChannel; target: string; message: string }) => void;
}) {
  const targets = ALL_TARGETS.filter((t) => channels.includes(t.key));
  const [channel, setChannel] = useState<ShareChannel>(targets[0]?.key ?? "email");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [groupValue, setGroupValue] = useState("");
  const [message, setMessage] = useState("");

  const groupList = GROUP_CHANNELS.includes(channel) ? groups[channel as "team" | "department" | "location"] ?? [] : [];

  function submit() {
    const target = USER_CHANNELS.includes(channel)
      ? users.find((u) => u.id === userId)?.name ?? "that person"
      : GROUP_CHANNELS.includes(channel)
        ? groupValue
        : email;
    onShare({ channel, target, message });
  }

  const disabled = channel === "email" ? !email : GROUP_CHANNELS.includes(channel) ? !groupValue : !userId;

  return (
    <Modal open={open} onClose={onClose} title="Share" widthClass="max-w-md">
      <div className="flex flex-col gap-5">
        <p className="text-xs text-[var(--text-soft)]">
          Sharing <span className="font-semibold text-[var(--text-body)]">&ldquo;{videoTitle}&rdquo;</span>
        </p>

        <div className="grid grid-cols-4 gap-2">
          {targets.map((t) => {
            const active = t.key === channel;
            return (
              <button
                key={t.key}
                onClick={() => setChannel(t.key)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-[var(--r-control)] px-1 py-3 text-[12px] font-semibold transition-colors ${
                  active ? "bg-brand text-white" : "bg-[var(--brand-tint-2)] text-[var(--text-body)] hover:bg-[var(--brand-soft)]/50"
                }`}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {channel === "email" && (
          <AuthInput label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.co.uk" icon={<Mail size={16} />} />
        )}
        {USER_CHANNELS.includes(channel) && (
          <AuthSelect label="Choose a registered user" value={userId} onChange={(e) => setUserId(e.target.value)} icon={<Users size={16} />}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </AuthSelect>
        )}
        {GROUP_CHANNELS.includes(channel) && (
          <AuthSelect label={`Choose a ${channel}`} value={groupValue} onChange={(e) => setGroupValue(e.target.value)}>
            <option value="">Choose…</option>
            {groupList.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </AuthSelect>
        )}

        <label className="flex flex-col gap-[7px]">
          <span className="text-[13px] font-semibold text-[var(--text-body)]">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Write here"
            className="rounded-[var(--r-field)] border-[1.5px] border-[var(--border-default)] bg-[#fdfdff] px-3.5 py-2.5 text-sm text-[var(--text-strong)] placeholder:text-[#9a93a1] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>

        <div className="flex justify-end">
          <Button className="rounded-[var(--r-control)]" onClick={submit} disabled={disabled}>
            Share <Share2 size={14} />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
