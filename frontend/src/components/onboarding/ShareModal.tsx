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

  const footer = (
    <div className="flex justify-end gap-3">
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={submit} disabled={disabled} size="lg">
        Share <Share2 size={18} />
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share"
      description="Choose how you want to send this help item."
      widthClass="max-w-lg"
      footer={footer}
    >
      <div className="flex flex-col gap-6">
        <p className="text-[var(--text-sm)] text-[var(--text-soft)]">
          Sharing <span className="font-semibold text-[var(--text-body)]">&ldquo;{videoTitle}&rdquo;</span>
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {targets.map((t) => {
            const active = t.key === channel;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setChannel(t.key)}
                className={`flex flex-col items-center justify-center gap-2 rounded-[var(--r-field)] px-2 py-4 text-[var(--text-xs)] font-semibold transition-all duration-200 ${
                  active
                    ? "bg-brand text-white shadow-md shadow-brand/25 scale-[1.02]"
                    : "bg-[var(--brand-tint-2)] text-[var(--text-body)] hover:bg-[var(--brand-soft)]/50 hover:scale-[1.02]"
                }`}
              >
                <t.icon size={20} />
                {t.label}
              </button>
            );
          })}
        </div>

        {channel === "email" && (
          <AuthInput
            label="Work email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.co.uk"
            icon={<Mail size={18} />}
          />
        )}
        {USER_CHANNELS.includes(channel) && (
          <AuthSelect
            label="Choose a registered user"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            icon={<Users size={18} />}
          >
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

        <label className="flex flex-col gap-2">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--text-body)]">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Write your message here…"
            className="rounded-[var(--r-field)] border border-[var(--border-default)] bg-[#fdfdff] px-3.5 py-3 text-[var(--text-sm)] text-[var(--text-strong)] placeholder:text-[var(--text-soft)] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 min-h-[110px]"
          />
        </label>
      </div>
    </Modal>
  );
}
