/**
 * The white form card used on every auth screen in the production Figma design:
 * rounded-[20px], soft ambient shadow, 24px padding, ~480px wide.
 */
export function AuthCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full rounded-[28px] bg-white px-8 py-8 shadow-[0_8px_32px_rgba(31,20,38,0.08),0_2px_8px_rgba(31,20,38,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

/** Standard card heading block: bold title + soft subtitle. */
export function AuthCardHeader({
  title,
  subtitle,
  align = "left",
}: {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`flex flex-col gap-1 ${align === "center" ? "items-center text-center" : ""}`}>
      <h1 className="text-[28px] font-extrabold leading-[1.2] tracking-[-0.03em] text-[var(--text-strong)]">
        {title}
      </h1>
      {subtitle && <p className="text-[15px] leading-relaxed text-[var(--text-soft)]">{subtitle}</p>}
    </div>
  );
}
