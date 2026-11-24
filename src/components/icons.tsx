/** Small line icons drawn for FLOWEAT (24px grid, 1.8 stroke). */
type P = { className?: string; title?: string };
const base = (className?: string) => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconNow = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="4" y="5" width="4" height="3" rx="1" />
    <rect x="4" y="10.5" width="4" height="3" rx="1" />
    <rect x="16" y="5" width="4" height="3" rx="1" />
    <rect x="16" y="10.5" width="4" height="3" rx="1" />
    <path d="M3 19h6M15 19h6M10.5 19h3" />
  </svg>
);
export const IconBowl = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3.5 11h17a8.5 8.5 0 0 1-17 0Z" />
    <path d="M9 7.5c0-1.2 1-1.2 1-2.4M13 7.5c0-1.2 1-1.2 1-2.4" />
  </svg>
);
export const IconTicket = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4Z" />
    <path d="M9 9.5h6M9 14.5h4" />
  </svg>
);
export const IconScan = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    <path d="M7 12h10" />
  </svg>
);
export const IconChevron = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const IconBack = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);
export const IconSearch = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);
export const IconBell = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </svg>
);
export const IconInfo = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const IconClose = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);
export const IconCheck = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconSeat = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="5" y="9" width="14" height="5" rx="1.5" />
    <path d="M7 14v5M17 14v5M8 9V6M16 9V6" />
  </svg>
);
