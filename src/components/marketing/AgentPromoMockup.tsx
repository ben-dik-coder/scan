import { ArrowUp, Clock } from "lucide-react";
import { AgentRobotIcon } from "@/components/agent/AgentRobotIcon";

const SCENARIOS = [
  {
    question: "Finn 10 frisører i Bergen med telefon",
    response: "Fant 10 frisører, 8 med telefon",
    listName: "Frisører Bergen",
  },
  {
    question: "Nye restauranter i Trondheim siste 30 dager",
    response: "Fant 14 nye serveringsfirma",
    listName: "Nye restauranter Trondheim",
  },
  {
    question: "Byggfirma i Vestfold med e-post",
    response: "Fant 6 byggfirma med kontaktinfo",
    listName: "Byggfirma Vestfold",
  },
] as const;

export function AgentPromoMockup() {
  return (
    <div
      className="agent-promo-mockup flex min-h-[440px] flex-col overflow-hidden rounded-[inherit] bg-[#1c1c1e] text-[#ececec] sm:min-h-[480px]"
      role="img"
      aria-label="Forhåndsvisning av NyLead-assistenten — chat som finner leads"
    >
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.05] bg-[#1c1c1e]/95 px-3 py-2.5 backdrop-blur-xl sm:px-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2f2f2f]">
          <AgentRobotIcon size={22} className="opacity-90" />
        </span>
        <span className="truncate text-[14px] font-medium tracking-[-0.01em] sm:text-[15px]">
          NyLead-assistent
        </span>
      </div>

      <div className="agent-promo-chat-body relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 sm:px-4">
        <div className="agent-promo-chat-history relative min-h-0 flex-1">
          {SCENARIOS.map((scenario, index) => (
            <div
              key={scenario.question}
              className={`agent-promo-scenario agent-promo-scenario--${index + 1} absolute inset-x-0 top-0 flex flex-col gap-3 sm:gap-4`}
            >
              <div className="agent-promo-user-row flex w-full justify-end">
                <div className="agent-promo-user-msg agent-chat-bubble agent-chat-bubble--user max-w-[88%]">
                  <p className="leading-relaxed">{scenario.question}</p>
                </div>
              </div>

              <div className="agent-promo-reply-area flex w-full flex-col gap-3 sm:gap-3.5">
                <div className="agent-promo-thinking-slot relative h-11 w-full shrink-0 sm:h-12">
                  <div className="agent-promo-thinking-row absolute inset-0 flex items-start justify-start">
                    <div className="agent-promo-thinking agent-chat-bubble agent-chat-bubble--assistant max-w-[92%] px-4 py-3">
                      <span className="agent-promo-dots flex items-center gap-1" aria-hidden>
                        <span className="agent-promo-dot" />
                        <span className="agent-promo-dot" />
                        <span className="agent-promo-dot" />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="agent-promo-assistant-row flex w-full justify-start">
                  <div className="agent-promo-assistant-msg agent-chat-bubble agent-chat-bubble--assistant max-w-[92%]">
                    <p className="agent-promo-response leading-relaxed">{scenario.response}</p>
                    <div className="agent-promo-link-block mt-3 flex flex-col gap-1 border-t border-white/[0.06] pt-2">
                      <span className="agent-promo-link text-left text-[13px] font-medium text-[#10a37f] sm:text-sm">
                        Åpne listen i Skann →
                      </span>
                      <span className="agent-promo-saved text-[11px] text-[#8e8e93]">
                        Lagret som «{scenario.listName}»
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.05] bg-[#1c1c1e] px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8e8e93]"
            aria-hidden
          >
            <Clock className="h-[17px] w-[17px]" />
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-[26px] border border-white/[0.08] bg-[#2f2f2f] px-3 py-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
            <span className="relative flex min-h-[36px] flex-1 items-center overflow-hidden py-2 sm:min-h-[40px]">
              <span className="agent-promo-input-placeholder text-[14px] text-[#8e8e93] sm:text-[15px]">
                Spør om hva som helst…
              </span>
              {SCENARIOS.map((scenario, index) => (
                <span
                  key={scenario.question}
                  className={`agent-promo-input-text agent-promo-input-text--${index + 1} absolute inset-y-0 left-0 flex items-center text-[14px] text-[#ececec] sm:text-[15px]`}
                >
                  {scenario.question}
                </span>
              ))}
            </span>
            <span
              className="agent-promo-send flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#424242] text-[#6b6b6b]"
              aria-hidden
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
