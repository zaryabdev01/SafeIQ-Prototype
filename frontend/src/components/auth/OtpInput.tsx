"use client";

import { useRef } from "react";

/**
 * Segmented one-time-code input from the Figma auth flow (used by the sign-up
 * "Verify email" step and the forgot-password flow). Controlled: `value` is the
 * digits entered so far, `onChange` receives the new string (max `length`).
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  ariaLabel = "One-time code",
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.split("").slice(0, length);

  function setDigit(index: number, raw: string) {
    const char = raw.replace(/\D/g, "").slice(-1);
    const next = value.split("");
    next[index] = char;
    const joined = next.join("").slice(0, length);
    onChange(joined);
    if (char && index < length - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < length - 1) refs.current[index + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  }

  return (
    <div className="flex gap-2.5" role="group" aria-label={ariaLabel}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          value={digits[i] ?? ""}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="h-12 w-12 rounded-[var(--r-control)] border-[1.5px] border-[var(--border-default)] bg-[#fdfdff] text-center text-lg font-bold text-[var(--text-strong)] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      ))}
    </div>
  );
}
