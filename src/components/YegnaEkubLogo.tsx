import React from 'react';

interface YegnaEkubLogoProps {
  variant?: 'full' | 'mark' | 'wordmark' | 'badge';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  theme?: 'dark' | 'light' | 'auto';
  showSubtext?: boolean;
  subtextText?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Refined YegnaEkub Brand Mark & Integrated Wordmark
 *
 * Design Concept:
 * - The letter "k" is creatively engineered as a dual-purpose glyph and business growth icon.
 * - The vertical stem represents trust, institutional security, and community stability.
 * - The lower diagonal grounds the collective pooling mechanism.
 * - The upper arm surges upward at a 45-degree angle as a precision-crafted ascending growth arrow,
 *   symbolizing individual economic mobility, business expansion, and revolving wealth generation.
 * - Perfectly balanced baseline and kerning to ensure seamless visual unity with "Yegna" and "Ekub".
 */
export const YegnaEkubLogo: React.FC<YegnaEkubLogoProps> = ({
  variant = 'full',
  size = 'md',
  theme = 'auto',
  showSubtext = false,
  subtextText = 'DIGITAL ROSCA',
  className = '',
  onClick,
}) => {
  // Size scale mappings
  const markSizeMap = {
    xs: 18,
    sm: 24,
    md: 32,
    lg: 40,
    xl: 48,
    '2xl': 64,
  };

  const textClassMap = {
    xs: 'text-sm tracking-tight',
    sm: 'text-base tracking-tight',
    md: 'text-xl tracking-tight',
    lg: 'text-2xl tracking-tight',
    xl: 'text-3xl tracking-tight',
    '2xl': 'text-4xl tracking-tight',
  };

  const subtextClassMap = {
    xs: 'text-[7px] tracking-[0.18em]',
    sm: 'text-[8px] tracking-[0.2em]',
    md: 'text-[9px] tracking-[0.22em]',
    lg: 'text-[10px] tracking-[0.24em]',
    xl: 'text-[11px] tracking-[0.26em]',
    '2xl': 'text-[13px] tracking-[0.28em]',
  };

  const markPx = markSizeMap[size] || 32;

  // Determine colors based on theme
  const isDark = theme === 'dark';
  const primaryTextColor = isDark ? '#FFFFFF' : '#1C1132';
  const subtextColor = isDark ? '#C4B5FD' : '#7856FF';

  /**
   * Standalone 'K' Growth Brandmark Symbol
   * Combines stepped ascending financial bars, solid structural pillar, and dynamic growth arrow.
   */
  const renderMark = (customPx?: number) => {
    const p = customPx || markPx;
    return (
      <svg
        width={p}
        height={p}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-xs select-none"
        aria-label="YegnaEkub Growth Brand Mark"
      >
        <defs>
          {/* Main Royal Amethyst Gradient */}
          <linearGradient id="yk-violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9E7EFF" />
            <stop offset="60%" stopColor="#7856FF" />
            <stop offset="100%" stopColor="#5530E8" />
          </linearGradient>

          {/* Ascending Trend Arrow Glow */}
          <linearGradient id="yk-arrow-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7856FF" />
            <stop offset="50%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#C4B5FD" />
          </linearGradient>

          {/* Stepped Financial Growth Bars Gradient */}
          <linearGradient id="yk-step-grad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#6340FF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.85" />
          </linearGradient>

          {/* Subtle Container Shadow */}
          <filter id="yk-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#7856FF" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Outer Hex-Rounded Dynamic Emblem Shield Background */}
        <rect
          x="1"
          y="1"
          width="46"
          height="46"
          rx="13"
          fill={isDark ? '#2B1B48' : '#F5F2FF'}
          stroke={isDark ? '#7856FF' : '#E6E1F5'}
          strokeWidth="1.5"
          strokeOpacity={isDark ? '0.45' : '1'}
        />

        {/* Stepped Growth Chart Level 1 (Community Savings Step) */}
        <rect
          x="9"
          y="28"
          width="4"
          height="10"
          rx="2"
          fill="url(#yk-step-grad)"
        />

        {/* Stepped Growth Chart Level 2 (Revolving Pool Accumulation Step) */}
        <rect
          x="15"
          y="21"
          width="4"
          height="17"
          rx="2"
          fill="url(#yk-step-grad)"
        />

        {/* Primary Pillar Stem of the 'K' (Solid Trust & Integrity Foundation) */}
        <rect
          x="21"
          y="10"
          width="4.5"
          height="28"
          rx="2.25"
          fill="url(#yk-violet-grad)"
        />

        {/* Lower Grounding Leg of the 'K' (Anchored Community Base) */}
        <path
          d="M24 25.5L34.5 37C35.2 37.8 36.5 37.8 37.2 37C37.8 36.3 37.8 35.1 37.1 34.3L28 24.2"
          stroke="url(#yk-violet-grad)"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Upper Ascending Arm of the 'K' - THE RISING GROWTH ARROW */}
        {/* Growth vector diagonal line */}
        <path
          d="M24 23.5L34 13.5"
          stroke="url(#yk-arrow-grad)"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Growth Arrow Head at the top-right apex */}
        <path
          d="M29 11.5H36.5C37.3 11.5 38 12.2 38 13V20.5"
          stroke="url(#yk-arrow-grad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Small Sparkling Economic Ascent Star / Micro-accent */}
        <circle cx="38" cy="9.5" r="1.5" fill="#C4B5FD" className="animate-pulse" />
      </svg>
    );
  };

  /**
   * Integrated Creative 'k' Inline Glyph
   * Seamlessly sits inside the word "Ekub" with identical baseline, matching x-height and ascender height,
   * while incorporating the signature rising upward growth arrow on its upper branch.
   */
  const renderCreativeInlineK = () => {
    // Proportional heights based on size
    const glyphHeightMap = {
      xs: 18,
      sm: 20,
      md: 24,
      lg: 28,
      xl: 34,
      '2xl': 44,
    };
    const gh = glyphHeightMap[size] || 24;
    const gw = Math.round(gh * 0.95);

    return (
      <span className="inline-flex items-center align-baseline mx-[0.5px] relative" style={{ height: gh, width: gw }}>
        <svg
          width={gw}
          height={gh}
          viewBox="0 0 24 26"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          <defs>
            <linearGradient id={`inline-k-grad-${size}-${theme}`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7856FF" />
              <stop offset="70%" stopColor="#8A67FF" />
              <stop offset="100%" stopColor="#A78BFA" />
            </linearGradient>
            <linearGradient id={`inline-stem-grad-${size}-${theme}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8A67FF" />
              <stop offset="100%" stopColor="#6340FF" />
            </linearGradient>
          </defs>

          {/* Vertical Stem of 'k' (Aligns with standard font ascender) */}
          <rect
            x="3"
            y="2"
            width="3.2"
            height="21"
            rx="1.6"
            fill={`url(#inline-stem-grad-${size}-${theme})`}
          />

          {/* Lower diagonal branch */}
          <path
            d="M5.8 14.5L14.8 22.8C15.3 23.3 16.1 23.3 16.6 22.8C17.1 22.3 17.1 21.5 16.6 21L9.2 13.6"
            stroke={`url(#inline-stem-grad-${size}-${theme})`}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Upper diagonal branch - ASCENDING GROWTH ARROW */}
          <path
            d="M5.8 13.2L15 4.5"
            stroke={`url(#inline-k-grad-${size}-${theme})`}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Integrated growth arrow head at top-right */}
          <path
            d="M10.8 3.5H16.5C17 3.5 17.5 4 17.5 4.5V10.2"
            stroke={`url(#inline-k-grad-${size}-${theme})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Micro Sparkle Accent on Arrow Tip */}
          <circle cx="17.5" cy="2" r="1" fill="#C4B5FD" />
        </svg>
      </span>
    );
  };

  /**
   * Integrated Typographic Wordmark
   * "Yegna" + "E" + [Creative Growth 'k'] + "ub"
   */
  const renderWordmark = () => {
    return (
      <div className="flex flex-col justify-center select-none leading-none">
        <div className={`font-bold ${textClassMap[size]} flex items-center tracking-tight font-sans`}>
          {/* First Word: Yegna */}
          <span 
            className="font-extrabold transition-colors"
            style={{ color: primaryTextColor }}
          >
            Yegna
          </span>

          {/* Second Word: Ekub with creative growth 'k' */}
          <span className="flex items-center ml-[0.5px]">
            <span className="font-extrabold text-[#7856FF]">E</span>
            {renderCreativeInlineK()}
            <span className="font-extrabold text-[#7856FF]">ub</span>
          </span>
        </div>

        {/* Optional Elegant Subtitle Tagline */}
        {showSubtext && (
          <span
            className={`font-semibold uppercase tracking-[0.24em] mt-0.5 transition-colors ${subtextClassMap[size]}`}
            style={{ color: subtextColor }}
          >
            {subtextText}
          </span>
        )}
      </div>
    );
  };

  // Render standalone mark
  if (variant === 'mark') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
      >
        {renderMark()}
      </div>
    );
  }

  // Render pure wordmark without standalone mark box
  if (variant === 'wordmark') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        {renderWordmark()}
      </div>
    );
  }

  // Render badge variant (Compact card format with subtle border)
  if (variant === 'badge') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center space-x-2.5 px-3 py-1.5 rounded-xl border ${
          isDark
            ? 'bg-[#2B1B48]/80 border-[#7856FF]/40 text-white'
            : 'bg-white border-[#E6E1F5] text-[#1C1132]'
        } shadow-xs ${onClick ? 'cursor-pointer hover:border-[#7856FF] transition-all' : ''} ${className}`}
      >
        {renderMark(markPx * 0.85)}
        {renderWordmark()}
      </div>
    );
  }

  // Full default variant: Standalone Growth Emblem + Creative Wordmark
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center space-x-2.5 sm:space-x-3 ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      <div className="transition-transform duration-200 group-hover:scale-105">
        {renderMark()}
      </div>
      {renderWordmark()}
    </div>
  );
};
