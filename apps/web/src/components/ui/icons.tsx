interface IconProps {
  className?: string;
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}

export function LogoMark({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="4 4 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M24 6L32.66 11L32.66 21L24 26L15.34 21L15.34 11ZM15.34 11L24 16L32.66 11M24 16L24 26M15.34 21L24 26L24 36L15.34 41L6.68 36L6.68 26ZM6.68 26L15.34 31L24 26M15.34 31L15.34 41M32.66 21L41.32 26L41.32 36L32.66 41L24 36L24 26M24 26L32.66 31L41.32 26M32.66 31L32.66 41" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const strokeIcon = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function SearchIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      strokeWidth="2"
      {...strokeIcon}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

/** Two opposite arrows: a count of transactions. */
export function TxCountIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      strokeWidth="2"
      {...strokeIcon}
    >
      <path d="M4 8H18M14 4L18 8L14 12M20 16H6M10 12L6 16L10 20" />
    </svg>
  );
}

/** A small cube: block size. */
export function SizeIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      strokeWidth="2"
      {...strokeIcon}
    >
      <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5ZM4 7.5L12 12L20 7.5M12 12V21" />
    </svg>
  );
}

/** ₿: amounts in sBTC. */
export function BitcoinIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      strokeWidth="2"
      {...strokeIcon}
    >
      <path d="M8 5V19M8 5H13.5a3.5 3.5 0 0 1 0 7H8M8 12H14.5a3.5 3.5 0 0 1 0 7H8M10 2.5V5M13 2.5V5M10 19V21.5M13 19V21.5" />
    </svg>
  );
}

const CUBE = "M24 4L42 14L42 34L24 44L6 34L6 14ZM6 14L24 24L42 14M24 24L24 44";

/** The timeline's block marker; `tinted` marks the newest block. */
export function CubeMarker({ className, tinted = false }: IconProps & { tinted?: boolean }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 48 48"
      strokeWidth="2"
      data-tinted={tinted || undefined}
      {...strokeIcon}
    >
      <path d={CUBE} />
    </svg>
  );
}

/** A dashed, grey cube: nothing here (empty states, not found). */
export function DashedCube({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="44"
      height="44"
      viewBox="0 0 48 48"
      strokeWidth="1.6"
      strokeDasharray="3 3"
      {...strokeIcon}
    >
      <path d={CUBE} />
    </svg>
  );
}

export function WarningIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      strokeWidth="2"
      {...strokeIcon}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </svg>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      strokeWidth="2.2"
      {...strokeIcon}
    >
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}
