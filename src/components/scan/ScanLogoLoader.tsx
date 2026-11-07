"use client";

/**
 * NyLead-logo som loading: søyler vokser → buer snor seg rundt.
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
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <linearGradient id="scanBarGrad2" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#166534" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="scanBarGrad3" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="scanBarGrad4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>

        {/* Blå bue: venstre → topp */}
        <path
          className="app-scan-logo-swoosh app-scan-logo-swoosh--blue"
          d="M24.8 93.6 A46 46 0 0 1 95.5 32.2"
          stroke="#2563eb"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        {/* Hvit bue: høyre → bunn → møter blå */}
        <path
          className="app-scan-logo-swoosh app-scan-logo-swoosh--white"
          d="M99.8 40.1 A46 46 0 0 1 22.3 90.4"
          stroke="#f8fafc"
          strokeWidth="5.5"
          strokeLinecap="round"
        />

        {/* Søyler midt i sirkelen */}
        <g className="app-scan-logo-bars">
          <rect
            className="app-scan-logo-bar app-scan-logo-bar--1"
            x="37"
            y="68"
            width="10"
            height="28"
            rx="1.5"
            fill="url(#scanBarGrad1)"
          />
          <rect
            className="app-scan-logo-bar app-scan-logo-bar--2"
            x="50"
            y="54"
            width="10"
            height="42"
            rx="1.5"
            fill="url(#scanBarGrad2)"
          />
          <rect
            className="app-scan-logo-bar app-scan-logo-bar--3"
            x="63"
            y="40"
            width="10"
            height="56"
            rx="1.5"
            fill="url(#scanBarGrad3)"
          />
          <rect
            className="app-scan-logo-bar app-scan-logo-bar--4"
            x="76"
            y="28"
            width="10"
            height="68"
            rx="1.5"
            fill="url(#scanBarGrad4)"
          />
        </g>
      </svg>
    </div>
  );
}
