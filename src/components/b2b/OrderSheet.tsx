/**
 * Folha do pedido/orçamento para imprimir ou salvar em PDF (Rodada 19c). Componente de apresentação (sem estado): marca,
 * comprador, itens (quantidade, preço, desconto), frete, total, condição de pagamento e observações. Cabe em A4.
 */

import { formatB2BCents } from "@/lib/b2b/format";
import { sheetTitle, type OrderSheetData } from "@/lib/b2b/order-sheet";

export default function OrderSheet({ data }: { data: OrderSheetData }) {
  const title = sheetTitle(data.kind);

  return (
    <article className="mx-auto w-full max-w-[780px] bg-white p-6 text-[13px] leading-snug text-[#1f1722] print:max-w-none print:p-0" data-testid="folha-pedido">
      <header className="flex items-start justify-between gap-4 border-b-2 border-[#55245f] pb-3">
        <div>
          <p className="font-serif text-2xl font-semibold text-[#55245f]">{data.brand}</p>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a0742b]">Desde 1997</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold uppercase">{title}</p>
          {data.number && <p className="font-bold">Nº {data.number}</p>}
          {data.dateLabel && <p>{data.dateLabel}</p>}
          {data.validUntilLabel && <p className="font-bold text-[#8a5a00]">Válido até {data.validUntilLabel}</p>}
        </div>
      </header>

      <section className="mt-3 grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#6c5b69]">Cliente</p>
          <p className="font-bold">{data.buyer.name || "—"}</p>
          {data.buyer.document && <p>{data.buyer.document}</p>}
          {data.buyer.email && <p>{data.buyer.email}</p>}
          {data.buyer.phone && <p>{data.buyer.phone}</p>}
        </div>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#6c5b69]">Entrega</p>
          {data.addressLines.length === 0 ? <p>—</p> : data.addressLines.map((line) => <p key={line}>{line}</p>)}
          {data.seller && <p className="mt-1 text-[#6c5b69]">Representante: {data.seller}</p>}
        </div>
      </section>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-b border-[#1f1722] text-left text-[10px] font-extrabold uppercase tracking-wide">
            <th className="py-1.5 pr-2">Produto</th>
            <th className="w-12 py-1.5 text-center">Qtd.</th>
            <th className="w-24 py-1.5 text-right">Preço un.</th>
            <th className="w-24 py-1.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => (
            <tr key={`${item.name}-${index}`} className="border-b border-[#e2d6df] align-top">
              <td className="py-1.5 pr-2">
                {item.name}
                {item.bonusQty > 0 && <span className="block text-[11px] font-bold text-[#2f7a4a]">+ {item.bonusQty} grátis (promoção)</span>}
              </td>
              <td className="py-1.5 text-center font-bold">{item.qty}</td>
              <td className="py-1.5 text-right">
                {item.listUnitCents && item.discountPercent ? (
                  <>
                    <span className="block text-[11px] text-[#6c5b69] line-through">{formatB2BCents(item.listUnitCents)}</span>
                    {formatB2BCents(item.unitCents)}
                    <span className="block text-[11px] font-bold text-[#1b4a9c]">−{item.discountPercent}%</span>
                  </>
                ) : (
                  formatB2BCents(item.unitCents)
                )}
              </td>
              <td className="py-1.5 text-right font-bold">{formatB2BCents(item.totalCents)}</td>
            </tr>
          ))}
          {data.displays.map((display) => (
            <tr key={display} className="border-b border-[#e2d6df]">
              <td className="py-1.5 pr-2 font-bold text-[#2f7a4a]" colSpan={3}>
                {display}
              </td>
              <td className="py-1.5 text-right font-bold text-[#2f7a4a]">{formatB2BCents(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="ml-auto mt-3 w-full max-w-[320px] space-y-1">
        <div className="flex justify-between"><span>Produtos</span><span>{formatB2BCents(data.subtotalCents)}</span></div>
        {data.couponDiscountCents > 0 && (
          <div className="flex justify-between text-[#2f7a4a]"><span>{data.couponLabel ?? "Cupom"}</span><span>−{formatB2BCents(data.couponDiscountCents)}</span></div>
        )}
        {data.paymentDiscountCents > 0 && (
          <div className="flex justify-between text-[#2f7a4a]"><span>Ajuste da forma de pagamento</span><span>−{formatB2BCents(data.paymentDiscountCents)}</span></div>
        )}
        {data.shippingCents !== null && (
          <div className="flex justify-between"><span>Frete{data.shippingLabel ? ` (${data.shippingLabel})` : ""}</span><span>{formatB2BCents(data.shippingCents)}</span></div>
        )}
        {data.totalCents !== null && (
          <div className="flex justify-between border-t-2 border-[#55245f] pt-1 text-base font-extrabold text-[#55245f]">
            <span>{data.paymentOptions.length > 0 ? "Total (preço cheio)" : "Total"}</span>
            <span>{formatB2BCents(data.totalCents)}</span>
          </div>
        )}
      </section>

      <section className="mt-3 border-t border-[#e2d6df] pt-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#6c5b69]">Condição de pagamento</p>
        <p className="font-bold">{data.paymentLabel}</p>
        {data.paymentOptions.length > 0 && (
          <ul className="mt-1 grid gap-x-6 sm:grid-cols-3 print:grid-cols-3">
            {data.paymentOptions.map((option) => (
              <li key={option.label}>
                {option.label}: <strong>{formatB2BCents(option.totalCents)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.note && (
        <section className="mt-3 border-t border-[#e2d6df] pt-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#6c5b69]">Observações</p>
          <p className="whitespace-pre-line">{data.note}</p>
        </section>
      )}

      <footer className="mt-5 border-t border-[#e2d6df] pt-2 text-[11px] text-[#6c5b69]">
        {data.kind === "quote"
          ? "Orçamento sem reserva de produtos. Os preços e o frete são confirmados ao fechar o pedido."
          : data.kind === "review"
            ? "Revisão do pedido: ainda não foi finalizado."
            : "Obrigado pela preferência."}
      </footer>
    </article>
  );
}
