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
      className={`w-full max-w-[480px] rounded-[20px] bg-white p-6 shadow-[0_0_4px_rgba(122,113,160,0.2)] ${className}`}
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
    <div className={`flex flex-col gap-1.5 ${align === "center" ? "text-center items-center" : ""}`}>
      <h1 className="text-[30px] font-extrabold leading-[1.15] tracking-[-0.03em] text-[var(--text-strong)]">
        {title}
      </h1>
      {subtitle && <p className="text-[15px] text-[var(--text-soft)]">{subtitle}</p>}
    </div>
  );
}
