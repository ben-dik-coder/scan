"use client";

/**
 * NyLead-logo som loading: søyler vokser → strek snor seg gjennom → pil.
 * Ren SVG + CSS (ingen ekstra libs).
 */
export function ScanLogoLoader() {
  return (
    <div className="app-scan-logo-loader" aria-hidden>
      <svg
        className="app-scan-logo-svg"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="scanBarGrad1" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <linearGradient id="scanBarGrad2" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="scanBarGrad3" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="scanBarGrad4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="scanArrowGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <filter id="scanSoftGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ytre swooshes */}
        <path
          className="app-scan-logo-swoosh app-scan-logo-swoosh--blue"
          d="M28 78 C18 62 22 38 42 26 C52 20 64 18 76 22"
          stroke="#2563eb"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          className="app-scan-logo-swoosh app-scan-logo-swoosh--white"
          d="M92 42 C104 56 102 78 84 92 C72 100 56 102 42 96"
          stroke="#f8fafc"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Søyler — vokser fra bunn (transform-origin bottom) */}
        <g className="app-scan-logo-bars">
          <rect
            className="app-scan-logo-bar app-scan-logo-bar--1"
            x="34"
            y="62"
            width="11"
            height="28"
            rx="2"
            fill="url(#scanBarGrad1)"
          />
          <rect
            className="app-scan-logo-bar app-scan-logo-bar--2"
            x="48"
            y="50"
            width="11"
            height="40"
            rx="2"
            fill="url(#scanBarGrad2)"
          />
          <rect
            className="app-scan-logo-bar app-scan-logo-bar--3"
            x="62"
            y="38"
            width="11"
            height="52"
            rx="2"
            fill="url(#scanBarGrad3)"
          />
          <rect
            className="app-scan-logo-bar app-scan-logo-bar--4"
            x="76"
            y="28"
            width="11"
            height="62"
            rx="2"
            fill="url(#scanBarGrad4)"
          />
        </g>

        {/* Strek som snor seg gjennom søylene → pil */}
        <g className="app-scan-logo-arrow" filter="url(#scanSoftGlow)">
          <path
            className="app-scan-logo-thread"
            d="M30 86 C38 78 42 70 46 64 C52 54 56 48 60 44 C66 38 72 34 80 30 L88 26"
            stroke="url(#scanArrowGrad)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="app-scan-logo-head"
            d="M82 18 L98 22 L86 34 Z"
            fill="#4ade80"
          />
        </g>
      </svg>
    </div>
  );
}
