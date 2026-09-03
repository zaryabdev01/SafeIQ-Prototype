/**
 * Numbered progress stepper from the Figma sign-up flow: circles 1..count with
 * connector lines. Completed steps keep their number (not a check) to match design.
 * `current` is the 0-based index of the active step.
 */
export function Stepper({ count, current }: { count: number; current: number }) {
  return (
    <div className="flex w-full items-center">
      {Array.from({ length: count }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex flex-1 items-center last:flex-none">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${
                done
                  ? "bg-brand text-white"
                  : active
                    ? "border-2 border-brand bg-white text-brand"
                    : "bg-[#e9e5f0] text-white"
              }`}
            >
              {i + 1}
            </div>
            {i < count - 1 && (
              <div className={`mx-1.5 h-[2px] flex-1 rounded-full ${i < current ? "bg-brand" : "bg-[#e9e5f0]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
