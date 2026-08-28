import Link from "next/link";

/**
 * SafeIQ wordmark from the production Figma design: "Safe" + a bordered "IQ"
 * box. Replaces the old shield icon on the auth screens.
 */
export function WordmarkLogo({
  tone = "dark",
  href = "/",
  className = "",
}: {
  tone?: "dark" | "light";
  href?: string | null;
  className?: string;
}) {
  const color = tone === "light" ? "text-white" : "text-[var(--brand-dark)]";
  const border = tone === "light" ? "border-white" : "border-[var(--brand-dark)]";

  const inner = (
    <span className={`inline-flex items-center gap-1.5 ${color} ${className}`}>
      <span className="font-extrabold text-[28px] leading-[30px] tracking-[-0.03em]">Safe</span>
      <span
        className={`inline-flex items-center justify-center rounded-[10px] border-2 ${border} px-1 py-[5px]`}
      >
        <span className="font-extrabold text-[22px] leading-none tracking-[-0.03em] opacity-70">IQ</span>
      </span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} aria-label="SafeIQ home" className="inline-flex">
      {inner}
    </Link>
  );
}
