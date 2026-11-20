interface SearchLinkLogoProps {
  onDarkBackground?: boolean | 'desktop';
  size?: 'sm' | 'md';
}

export function SearchLinkLogo({
  onDarkBackground = false,
  size = 'md',
}: SearchLinkLogoProps) {
  const iconClass =
    size === 'sm'
      ? 'w-5 h-5 shrink-0 drop-shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
      : 'w-6 h-6 sm:w-7 sm:h-7 shrink-0 drop-shadow-[0_1px_2px_rgba(15,23,42,0.08)]';

  const textSizeClass =
    size === 'sm'
      ? 'text-[15px] font-semibold tracking-[-0.025em] leading-none transition-colors duration-300'
      : 'text-[17px] sm:text-[18px] font-semibold tracking-[-0.025em] leading-none transition-colors duration-300';

  const textToneClass =
    onDarkBackground === true
      ? 'text-white drop-shadow-[0_1px_10px_rgba(15,23,42,0.55)]'
      : onDarkBackground === 'desktop'
        ? 'text-slate-950 lg:text-white lg:drop-shadow-[0_1px_10px_rgba(15,23,42,0.55)]'
        : 'text-slate-950';

  return (
    <div
      aria-label="Search Link"
      className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 select-none"
    >
      {/* Pure geometric mark with tight viewBox so the wordmark sits snugly beside it */}
      <svg
        viewBox="2.5 2.5 26.5 26.5"
        className={iconClass}
        fill="none"
        aria-hidden="true"
      >
        {/* Top-left search arc (Coral Red) */}
        <path
          d="M 5.2 12.1 A 8.8 8.8 0 0 1 13.4 4.7"
          stroke="#EA4335"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        {/* Top-right search arc (Royal Blue) */}
        <path
          d="M 17.5 5.4 A 8.8 8.8 0 0 1 22.3 13.8"
          stroke="#2563EB"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        {/* Bottom-left search arc (Warm Amber) */}
        <path
          d="M 12.2 22.2 A 8.8 8.8 0 0 1 5.1 16.2"
          stroke="#F59E0B"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        {/* Interlocking link loop extending cleanly through the lower-right (Emerald Green) */}
        <path
          d="M 18.6 13.3 L 25.4 20.1 A 3.75 3.75 0 0 1 20.1 25.4 L 13.3 18.6"
          stroke="#16A34A"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <span className={`${textSizeClass} ${textToneClass}`}>Search Link</span>
    </div>
  );
}
