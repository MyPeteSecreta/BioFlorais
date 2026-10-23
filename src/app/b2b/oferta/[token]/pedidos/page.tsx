/**
 * "Meus pedidos" no link B2B: todos os pedidos DESTE cliente (o cliente vem do
 * token da oferta), cada um abrindo o acompanhamento assinado.
 */

import Link from "next/link";

import { formatB2BCents } from "@/lib/b2b/format";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import QuoteActions from "@/components/b2b/QuoteActions";
import { QUOTE_LABEL, isQuoteStatus, listClientQuotes } from "@/lib/b2b/quote-order";
import { continueQuotePath, printQuotePath } from "@/lib/b2b/quote-links";
import { listClientOrders, progressLabel, signTrackingToken } from "@/lib/order-tracking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const METHOD: Record<string, string> = { pix: "Pix", card: "Cartão", boleto: "Boleto" };

export default async function MyOrdersPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolution = await loadPublicB2BOfferContext(token);
  const offerHref = `/b2b/oferta/${encodeURIComponent(token)}`;

  if (!resolution.ok) {
    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]">
        <p>Este link não está disponível.</p>
      </main>
    );
  }

  const run = getAppSqlRunner();
  // Orçamentos (pedido sem pagamento) ficam numa seção própria; a lista de pedidos não os mistura.
  const orders = (await listClientOrders(run, resolution.context.clientId)).filter((order) => !isQuoteStatus(order.status));
  const quotes = await listClientQuotes(run, resolution.context.clientId);
  const base = `/b2b/oferta/${encodeURIComponent(token)}`;
  const dateOf = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(value));

  return (
    <main className="min-h-screen bg-[#fffaf6] px-4 py-8 text-[#422347]">
      <div className="mx-auto max-w-2xl">
        <Link href={offerHref} className="text-sm font-bold text-[#63326d] underline underline-offset-4">
          ← Voltar às linhas
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-[#55245f]">Meus pedidos</h1>
        <p className="mt-1 text-sm text-[#6c5b69]">{resolution.context.clientDisplayName}</p>

        {quotes.length > 0 && (
          <section className="mt-5" data-testid="orcamentos-pendentes">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#a0742b]">Orçamentos</h2>
            <ul className="mt-2 space-y-3">
              {quotes.map((quote) => (
                <li key={quote.orderId} className="rounded-[20px] border border-[#f0d9a8] bg-[#fffaf0] p-4">
                  <p className="font-extrabold">
                    Orçamento #{quote.orderId.slice(0, 8).toUpperCase()}{" "}
                    <span className="ml-1 rounded-full bg-[#fff3d6] px-2 py-0.5 text-xs font-extrabold text-[#8a5a00]">
                      {quote.expired ? "Vencido" : QUOTE_LABEL}
                    </span>
                  </p>
                  <p className="text-xs text-[#8a7886]">
                    Salvo em {dateOf(quote.createdAt)}
                    {quote.expiresAt ? ` · ${quote.expired ? "venceu" : "válido"} até ${dateOf(quote.expiresAt)}` : ""} · {formatB2BCents(quote.totalCents)}
                  </p>
                  <QuoteActions
                    className="mt-3"
                    continueHref={continueQuotePath(token, quote.orderId)}
                    printHref={printQuotePath(quote.orderId, token)}
                    who={resolution.context.clientDisplayName}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="mt-6 text-sm font-extrabold uppercase tracking-wide text-[#a0742b]">Pedidos</h2>
        <ul className="mt-2 space-y-3">
          {orders.length === 0 && (
            <li className="rounded-[20px] border border-dashed border-[#d9c7dc] bg-white p-6 text-sm text-[#6c5b69]">
              Você ainda não fez pedidos por este link.
            </li>
          )}
          {orders.map((order) => {
            const signed = signTrackingToken(order.orderId);

            return (
              <li key={order.orderId} className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#eadfd9] bg-white p-4">
                <div>
                  <p className="font-extrabold">Pedido #{order.number}</p>
                  <p className="text-xs text-[#8a7886]">
                    {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(order.createdAt)} ·{" "}
                    {METHOD[order.paymentMethod ?? ""] ?? "—"} · {formatB2BCents(order.totalCents)}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#55245f]">{progressLabel(order.status, order.fulfillmentStatus)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`${base}/pedidos/${order.orderId}/imprimir`} className="rounded-full border-2 border-[#55245f] px-4 py-2 text-sm font-extrabold text-[#55245f]" data-testid="imprimir-meu-pedido">
                    Imprimir / PDF
                  </Link>
                  {signed && (
                    <Link href={`/acompanhe/${signed}`} className="rounded-full bg-[#55245f] px-4 py-2 text-sm font-extrabold text-white">
                      Acompanhar
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
