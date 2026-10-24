/**
 * Faixa de benefícios do checkout: discreta, alegre e genérica (nunca cita um cupom específico).
 * Componente de apresentação, sem hooks nem dependência do site: a Secreta e a My Pet copiam este arquivo e
 * `src/lib/checkout/benefits.ts`, trocando só a configuração. `variant="compact"` serve para perto do botão de pagar.
 */

import type { CheckoutBenefit, CheckoutBenefitIcon } from "@/lib/checkout/benefits";

function Icon({ name }: { name: CheckoutBenefitIcon }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "h-4 w-4 shrink-0", "aria-hidden": true };

  if (name === "frete") {
    return (
      <svg {...common}>
        <path d="M3 7h11v9H3z" />
        <path d="M14 10h4l3 3v3h-7z" />
        <circle cx="7.5" cy="17.5" r="1.6" />
        <circle cx="17.5" cy="17.5" r="1.6" />
      </svg>
    );
  }

  if (name === "pix") {
    return (
      <svg {...common}>
        <path d="M12 3l4 4-4 4-4-4z" />
        <path d="M12 13l4 4-4 4-4-4z" />
        <path d="M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </svg>
  );
}

export default function CheckoutBenefitsBar({ benefits, variant = "summary", className = "" }: { benefits: CheckoutBenefit[]; variant?: "summary" | "compact"; className?: string }) {
  if (benefits.length === 0) return null;

  const chips = benefits.filter((benefit) => benefit.tone === "good");
  const progress = benefits.filter((benefit) => benefit.tone === "progress");
  const compact = variant === "compact";

  return (
    <div
      data-testid={compact ? "faixa-beneficios-compacta" : "faixa-beneficios"}
      role="status"
      aria-label="Benefícios da sua compra"
      className={`rounded-2xl border border-[#ead9a8] bg-gradient-to-r from-[#fff8e6] to-[#fdf1f4] ${compact ? "px-3 py-2.5" : "px-3.5 py-3"} ${className}`}
    >
      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {chips.map((benefit) => (
            <li key={benefit.key} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-[#55245f] ring-1 ring-[#ead9a8]">
              <span className="text-[#a0742b]">
                <Icon name={benefit.icon} />
              </span>
              <span>
                {benefit.label}
                {benefit.detail ? <span className="font-normal text-[#6c5b69]"> · {benefit.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {progress.map((benefit) => (
        <p key={benefit.key} className={`${chips.length > 0 ? "mt-2" : ""} flex items-center gap-1.5 text-xs font-semibold text-[#8a5a12]`}>
          <Icon name={benefit.icon} />
          <span>{benefit.label}</span>
        </p>
      ))}
    </div>
  );
}
