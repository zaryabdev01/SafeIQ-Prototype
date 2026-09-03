/**
 * Decorative 3D-style purple blob for the auth marketing panel / app sidebar
 * (bottom-right).
 */
export function AuthPanelBlob({
  className = "pointer-events-none absolute bottom-0 right-0 h-[min(72vh,620px)] w-[min(68vw,560px)] translate-x-[12%] translate-y-[14%]",
  idPrefix = "auth",
}: {
  className?: string;
  /** Prefix SVG paint-server ids so multiple instances on a page don't clash. */
  idPrefix?: string;
}) {
  const main = `${idPrefix}-blob-main`;
  const secondary = `${idPrefix}-blob-secondary`;
  const highlight = `${idPrefix}-blob-highlight`;

  return (
    <div aria-hidden className={className}>
      <svg
        viewBox="0 0 560 620"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full overflow-visible"
        preserveAspectRatio="xMaxYMax meet"
      >
        <defs>
          <radialGradient id={main} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#ddd0f5" />
            <stop offset="28%" stopColor="#b49ae8" />
            <stop offset="58%" stopColor="#7c5fd4" />
            <stop offset="100%" stopColor="#3d2478" />
          </radialGradient>
          <radialGradient id={secondary} cx="42%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#d8cbf2" />
            <stop offset="35%" stopColor="#9a7fd8" />
            <stop offset="100%" stopColor="#4a2f8a" />
          </radialGradient>
          <radialGradient id={highlight} cx="28%" cy="22%" r="45%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* main blob */}
        <path
          d="M430 120 C520 95 560 200 545 310 C530 430 455 520 355 545 C245 572 155 500 130 395 C105 290 165 185 265 145 C325 120 370 132 430 120 Z"
          fill={`url(#${main})`}
          opacity="0.95"
        />
        <path
          d="M430 120 C520 95 560 200 545 310 C530 430 455 520 355 545 C245 572 155 500 130 395 C105 290 165 185 265 145 C325 120 370 132 430 120 Z"
          fill={`url(#${highlight})`}
          opacity="0.55"
        />

        {/* smaller secondary blob */}
        <ellipse cx="175" cy="515" rx="88" ry="82" fill={`url(#${secondary})`} opacity="0.9" />
        <ellipse cx="155" cy="495" rx="42" ry="36" fill={`url(#${highlight})`} opacity="0.45" />
      </svg>
    </div>
  );
}
