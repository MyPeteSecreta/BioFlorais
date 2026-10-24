/**
 * Faixa do topo do checkout: uma linha discreta e alegre com os benefícios fixos (texto vindo de `buildCheckoutTopStrip`).
 * Componente de apresentação, sem hooks nem dependência do site: a Secreta e a My Pet copiam este arquivo.
 */

export default function CheckoutTopStrip({ parts, className = "" }: { parts: string[]; className?: string }) {
  if (parts.length === 0) return null;

  return (
    <p
      data-testid="faixa-topo-checkout"
      role="status"
      className={`rounded-2xl border border-[#ead9a8] bg-gradient-to-r from-[#fff8e6] to-[#fdf1f4] px-4 py-2.5 text-center text-xs font-semibold leading-5 text-[#55245f] sm:text-sm ${className}`}
    >
      {parts.join(" · ")}
    </p>
  );
}
