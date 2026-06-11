"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Globe, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const CYCLE_MS = 11_000;

const COMPANIES = [
  {
    name: "Tommeliten Barneklær AS",
    orgNr: "912 345 678",
    phone: "62 12 34 56",
    email: "post@tommeliten.no",
    website: "tommeliten.no",
  },
  {
    name: "Hakket Bedre AS",
    orgNr: "923 456 789",
    phone: "62 98 76 54",
    email: "hei@hakketbedre.no",
    website: "hakketbedre.no",
  },
  {
    name: "Fjellro AS",
    orgNr: "934 567 890",
    phone: "61 45 67 89",
    email: "kontakt@fjellro.no",
    website: "fjellro.no",
  },
  {
    name: "Nordlys Kaffe AS",
    orgNr: "945 678 901",
    phone: "62 11 22 33",
    email: "info@nordlyskaffe.no",
    website: "nordlyskaffe.no",
  },
  {
    name: "Østfold Verksted AS",
    orgNr: "956 789 012",
    phone: "69 44 55 66",
    email: "post@ostfoldverksted.no",
    website: "ostfoldverksted.no",
  },
  {
    name: "Bergmann Media AS",
    orgNr: "967 890 123",
    phone: "62 77 88 99",
    email: "hei@bergmannmedia.no",
    website: "bergmann.no",
  },
] as const;

const ENGINES = [
  { id: "google", label: "Google", short: "G", accent: "#4285F4", slot: 0 },
  { id: "facebook", label: "Facebook", short: "f", accent: "#1877F2", slot: 1 },
  { id: "gulesider", label: "Gulesider", short: "Gu", accent: "#E31837", slot: 2 },
  { id: "timma", label: "Timma", short: "T", accent: "#FF6B35", slot: 3 },
  { id: "fixit", label: "Fixit", short: "Fi", accent: "#00A651", slot: 4 },
] as const;

const RESULT_FIELDS = [
  { id: "phone", label: "Telefon", key: "phone" as const, icon: Phone, slot: 0 },
  { id: "email", label: "E-post", key: "email" as const, icon: Mail, slot: 1 },
  { id: "website", label: "Nettside", key: "website" as const, icon: Globe, slot: 2 },
] as const;

const FLOW_BRANCH_X = [10, 30, 50, 70, 90] as const;

const ARIA_LABEL =
  "NyLead henter bedriftsinfo fra Google, sosiale medier, Timma, Fixit og andre kilder — og samler alt i én oversikt";

export function SourcesEnrichmentAnimation({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [companyIndex, setCompanyIndex] = useState(0);
  const [active, setActive] = useState(false);
  const company = COMPANIES[companyIndex];

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const syncActive = () => {
      const paused = root.closest(".landing-anim-paused");
      setActive(!paused);
    };

    syncActive();

    const observer = new MutationObserver(syncActive);
    const wrap = root.closest(".landing-anim-wrap");
    if (wrap) {
      observer.observe(wrap, { attributes: true, attributeFilter: ["class"] });
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;

    const id = window.setInterval(() => {
      setCompanyIndex((index) => (index + 1) % COMPANIES.length);
    }, CYCLE_MS);

    return () => window.clearInterval(id);
  }, [active]);

  return (
    <div
      ref={rootRef}
      className={cn("sources-enrichment", active && "sources-enrichment--active", className)}
      role="img"
      aria-label={ARIA_LABEL}
    >
      <div className="sources-enrichment-stage">
        <div className="sources-enrichment-company">
          <p className="sources-enrichment-eyebrow">Fra Brreg</p>
          <div className="sources-enrichment-name-wrap">
            <p key={company.name} className="sources-enrichment-name sources-enrichment-swap">
              {company.name}
            </p>
            <span className="sources-enrichment-scan-beam" aria-hidden />
          </div>
          <p key={company.orgNr} className="sources-enrichment-org sources-enrichment-swap">
            Org.nr {company.orgNr}
          </p>
        </div>

        <div className="sources-enrichment-flow-block">
          <svg
            className="sources-enrichment-flow-svg"
            viewBox="0 0 100 26"
            preserveAspectRatio="none"
            aria-hidden
          >
            <g className="sources-enrichment-flow-paths">
              <line className="sources-enrichment-flow-trunk" x1="50" y1="0" x2="50" y2="8" />
              <line className="sources-enrichment-flow-trunk" x1="10" y1="8" x2="90" y2="8" />
              {FLOW_BRANCH_X.map((x, index) => (
                <line
                  key={x}
                  className={cn(
                    "sources-enrichment-flow-branch",
                    `sources-enrichment-flow-branch--${index}`,
                  )}
                  x1={x}
                  y1="8"
                  x2={x}
                  y2="20"
                />
              ))}
            </g>
          </svg>

          <div className="sources-enrichment-icons">
            {ENGINES.map((engine) => (
              <div key={engine.id} className="sources-enrichment-icon-cell">
                <div
                  className="sources-enrichment-engine"
                  style={{ "--engine-accent": engine.accent } as React.CSSProperties}
                >
                  <span
                    className={cn(
                      "sources-enrichment-engine-ring",
                      `sources-enrichment-engine-ring--${engine.slot}`,
                    )}
                    aria-hidden
                  />
                  <div
                    className={cn(
                      "sources-enrichment-engine-pill",
                      `sources-enrichment-engine-pill--${engine.slot}`,
                    )}
                  >
                    <span className="sources-enrichment-engine-mark">{engine.short}</span>
                    <span
                      className={cn(
                        "sources-enrichment-engine-check",
                        `sources-enrichment-engine-check--${engine.slot}`,
                      )}
                      aria-hidden
                    >
                      <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={3} />
                    </span>
                  </div>
                  <span
                    className={cn(
                      "sources-enrichment-engine-scanned",
                      `sources-enrichment-engine-scanned--${engine.slot}`,
                    )}
                    aria-hidden
                  >
                    Scannet
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="sources-enrichment-labels">
            {ENGINES.map((engine) => (
              <span key={engine.id} className="sources-enrichment-engine-label">
                {engine.label}
              </span>
            ))}
          </div>
        </div>

        <div className="sources-enrichment-connector" aria-hidden>
          <span className="sources-enrichment-connector-line" />
        </div>

        <div className="sources-enrichment-results">
          <p className="sources-enrichment-results-title">Beriket lead</p>
          <div className="sources-enrichment-badges">
            {RESULT_FIELDS.map((result) => {
              const Icon = result.icon;
              return (
                <div
                  key={result.id}
                  className={cn(
                    "sources-enrichment-badge",
                    `sources-enrichment-badge--${result.slot}`,
                  )}
                >
                  <span className="sources-enrichment-badge-icon" aria-hidden>
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.25} />
                  </span>
                  <span className="sources-enrichment-badge-copy">
                    <span className="sources-enrichment-badge-label">{result.label}</span>
                    <span
                      key={company[result.key]}
                      className="sources-enrichment-badge-value sources-enrichment-swap"
                    >
                      {company[result.key]}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
