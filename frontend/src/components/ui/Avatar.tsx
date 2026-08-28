import { initials } from "@/lib/format";

export function Avatar({
  name,
  color,
  size = 36,
  className = "rounded-full",
}: {
  name: string;
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center font-semibold text-white shrink-0 ${className}`}
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}
