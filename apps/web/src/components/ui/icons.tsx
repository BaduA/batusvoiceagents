/** Small SF-Symbols-like line icons. 1.7 stroke, round caps, currentColor. */
type P = { size?: number; className?: string };
const S = ({ size = 18, className, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
);

export const IconPhone = (p: P) => (
  <S {...p}>
    <path d="M6.6 3.8 8.9 3.3l1.6 3.9-1.9 1.5a11 11 0 0 0 6.6 6.6l1.5-1.9 3.9 1.6-.5 2.3a2 2 0 0 1-2 1.6A15.6 15.6 0 0 1 3.6 4.9a2 2 0 0 1 1.6-2Z" fill="currentColor" stroke="none" />
  </S>
);
export const IconPhoneDown = (p: P) => (
  <S {...p}>
    <path d="M3 13.6c5-4.2 13-4.2 18 0l-.6 2.6-3.9-.8-.3-2.4a10 10 0 0 0-8.4 0l-.3 2.4-3.9.8Z" fill="currentColor" stroke="none" />
  </S>
);
export const IconMic = (p: P) => (
  <S {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </S>
);
export const IconMicOff = (p: P) => (
  <S {...p}>
    <path d="M15 9.5V6a3 3 0 0 0-5.6-1.5M9 9v2a3 3 0 0 0 4.8 2.4M5.5 11a6.5 6.5 0 0 0 10.6 5M18.5 11a6.4 6.4 0 0 1-.6 2.7M12 17.5V21M4 4l16 16" />
  </S>
);
export const IconTask = (p: P) => (
  <S {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
    <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
  </S>
);
export const IconPersona = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </S>
);
export const IconBook = (p: P) => (
  <S {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Zm0 15A2.5 2.5 0 0 1 6.5 18H20v3H6.5" />
  </S>
);
export const IconBolt = (p: P) => (
  <S {...p}>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6Z" />
  </S>
);
export const IconWave = (p: P) => (
  <S {...p}>
    <path d="M3 12h2M7 8v8M11 5v14M15 8.5v7M19 10.5v3M21 12h0" />
  </S>
);
export const IconSliders = (p: P) => (
  <S {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </S>
);
export const IconGauge = (p: P) => (
  <S {...p}>
    <path d="M4 17a8 8 0 1 1 16 0" />
    <path d="m12 17 4-6" />
  </S>
);
export const IconShare = (p: P) => (
  <S {...p}>
    <path d="M12 15V3.5M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </S>
);
export const IconPlus = (p: P) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const IconChevron = (p: P) => (
  <S {...p}>
    <path d="m9 6 6 6-6 6" />
  </S>
);
export const IconSidebarRight = (p: P) => (
  <S {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <path d="M15 4.5v15" />
  </S>
);
export const IconWarn = (p: P) => (
  <S {...p}>
    <path d="M12 4 2.8 19.5h18.4Z" />
    <path d="M12 10v4M12 17h0" />
  </S>
);
