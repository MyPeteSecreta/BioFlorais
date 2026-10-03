/**
 * Acompanhamento do pedido por link assinado (sem digitar nada). Serve B2C e
 * B2B. Só mostra o pedido do token; endereço parcial; nada de PII na URL.
 */

import Link from "next/link";

import TrackShare from "@/components/TrackShare";
import { formatB2BCents } from "@/lib/b2b/format";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadTrackingView, verifyTrackingToken } from "@/lib/order-tracking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acompanhe seu pedido | Bio Florais", robots: { index: false, follow: false } };

const METHOD: Record<string, string> = { pix: "Pix", card: "Cartão", boleto: "Boleto" };
const fmt = (value: string | null) => (value ? value.split("-").reverse().join("/") : "—");

function NotFound() {
  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-16 text-center text-[#422347]">
      <h1 className="font-serif text-3xl font-semibold text-[#55245f]">Pedido não encontrado</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-[#6c5b69]">Este link não é válido. Busque o pedido pelo número e e-mail ou CPF/CNPJ.</p>
      <Link href="/acompanhe-seu-pedido" className="mt-5 inline-block rounded-full bg-[#55245f] px-6 py-3 text-sm font-extrabold text-white">
        Acompanhe seu pedido
      </Link>
    </main>
  );
}

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const orderId = verifyTrackingToken(decodeURIComponent(token));

  if (!orderId) return <NotFound />;

  const view = await loadTrackingView(getAppSqlRunner(), orderId);

  if (!view) return <NotFound />;

  const path = `/acompanhe/${token}`;
  const { timeline } = view;

  return (
    <main className="min-h-screen bg-[#fffaf6] px-4 py-8 text-[#422347]">
      <div className="mx-auto max-w-2xl space-y-5">
        <header>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9b6c24]">Bio Florais</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[#55245f]">Pedido #{view.number}</h1>
          <p className="mt-1 text-sm text-[#6c5b69]">
            Feito em {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(view.createdAt)} ·{" "}
            {METHOD[view.paymentMethod ?? ""] ?? view.paymentMethod ?? "—"}
          </p>
          <div className="mt-3">
            <TrackShare path={path} number={view.number} />
          </div>
        </header>

        {timeline.cancelled ? (
          <section className="rounded-[24px] border-2 border-red-200 bg-red-50 p-5">
            <h2 className="text-lg font-extrabold text-red-900">Pedido cancelado</h2>
            <p className="mt-1 text-sm text-red-900/90">
              Este pedido foi cancelado ou o pagamento não foi concluído. Se você já pagou ou acha que houve um engano, fale com o{" "}
              <Link href="/atendimento" className="font-bold underline">atendimento</Link> informando o número #{view.number}. Estornos seguem o prazo do meio de pagamento.
            </p>
          </section>
        ) : (
          <section className="rounded-[24px] border border-[#eadfd9] bg-white p-5">
            <h2 className="font-extrabold">Andamento</h2>
            <ol className="mt-4 space-y-4">
              {timeline.steps.map((step) => (
                <li key={step.key} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      step.state === "done"
                        ? "bg-[#1f9d55] text-white"
                        : step.state === "current"
                          ? "border-2 border-[#55245f] bg-white text-[#55245f]"
                          : "border-2 border-[#d9ccc4] bg-white text-transparent"
                    }`}
                  >
                    {step.state === "done" ? "✓" : "•"}
                  </span>
                  <div>
                    <p className={`font-bold ${step.state === "pending" ? "text-[#9c8c98]" : ""}`}>{step.label}</p>
                    {step.detail && <p className="text-sm text-[#6c5b69]">{step.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>

            {view.trackingCode && (
              <p className="mt-5 rounded-2xl bg-[#f6eef7] p-4 text-sm">
                <strong>{view.carrier ?? "Transportadora"}</strong> · código de rastreio:{" "}
                {view.trackingUrl ? (
                  <a href={view.trackingUrl} target="_blank" rel="noreferrer" className="font-extrabold text-[#55245f] underline">{view.trackingCode}</a>
                ) : (
                  <a
                    href={`https://www.melhorrastreio.com.br/rastreio/${encodeURIComponent(view.trackingCode)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-extrabold text-[#55245f] underline"
                  >
                    {view.trackingCode}
                  </a>
                )}
              </p>
            )}
          </section>
        )}

        {view.pixCode && (
          <section className="rounded-[24px] border border-blue-200 bg-blue-50 p-5">
            <h2 className="font-extrabold text-blue-900">Pix aguardando pagamento</h2>
            <p className="mt-1 text-sm text-blue-900/80">Copie o código e pague no app do seu banco (válido por poucos minutos).</p>
            <textarea readOnly value={view.pixCode} className="mt-3 h-24 w-full rounded-xl border border-blue-200 bg-white p-3 text-xs" aria-label="Pix copia e cola" />
          </section>
        )}

        {view.boleto.length > 0 && (
          <section className="rounded-[24px] border border-[#eadfd9] bg-white p-5">
            <h2 className="font-extrabold">Boleto: parcelas</h2>
            <ul className="mt-3 divide-y divide-[#f1e8e4] text-sm">
              {view.boleto.map((parcel) => (
                <li key={parcel.installment} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    Parcela {parcel.installment}/{parcel.installments} · vence em {fmt(parcel.dueDate)}
                  </span>
                  <span className="font-bold">
                    {formatB2BCents(parcel.amountCents)} ·{" "}
                    {{ pago: "Paga", aberto: "Em aberto", vencido: "Vencida", cancelado: "Cancelada" }[parcel.status]}
                    {parcel.paidAt ? ` em ${fmt(parcel.paidAt)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[#8a7886]">Dúvidas sobre o boleto? Fale com o seu representante ou com o atendimento.</p>
          </section>
        )}

        <section className="rounded-[24px] border border-[#eadfd9] bg-white p-5">
          <h2 className="font-extrabold">Itens</h2>
          <ul className="mt-3 divide-y divide-[#f1e8e4] text-sm">
            {view.items.map((item, index) => (
              <li key={index} className="flex items-start justify-between gap-3 py-2">
                <span>
                  <strong>{item.qty}×</strong> {item.name}
                  {item.bonified && <span className="ml-2 rounded-full bg-[#e3f5e9] px-2 py-0.5 text-xs font-extrabold text-[#1f6b3a]">bonificado</span>}
                </span>
                <span className="shrink-0 font-semibold">{item.bonified ? "grátis" : formatB2BCents(item.unitPriceCents * item.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-[#f1e8e4] pt-3 text-sm">
            <div className="flex justify-between"><dt>Produtos</dt><dd>{formatB2BCents(view.subtotalCents)}</dd></div>
            {view.discountCents > 0 && <div className="flex justify-between"><dt>Descontos</dt><dd>− {formatB2BCents(view.discountCents)}</dd></div>}
            <div className="flex justify-between"><dt>Frete</dt><dd>{formatB2BCents(view.shippingCents)}</dd></div>
            <div className="flex justify-between text-base font-extrabold"><dt>Total</dt><dd>{formatB2BCents(view.totalCents)}</dd></div>
          </dl>
        </section>

        <section className="rounded-[24px] border border-[#eadfd9] bg-white p-5 text-sm">
          <h2 className="font-extrabold">Entrega</h2>
          {view.addressPartial && <p className="mt-2">Destino: {view.addressPartial}</p>}
          <p className="mt-1 text-[#6c5b69]">
            Prazo estimado: conforme a modalidade escolhida na compra (veja{" "}
            <Link href="/frete-e-entrega" className="font-bold text-[#63326d] underline">Frete e entrega</Link>).
          </p>
          <p className="mt-3">
            Precisa de ajuda? SAC:{" "}
            <a href="mailto:sac@bioflorais.com.br" className="font-bold text-[#63326d] underline">sac@bioflorais.com.br</a> ·{" "}
            <a href="https://wa.me/552139553713" target="_blank" rel="noreferrer" className="font-bold text-[#63326d] underline">WhatsApp</a>
          </p>
        </section>
      </div>
    </main>
  );
}
