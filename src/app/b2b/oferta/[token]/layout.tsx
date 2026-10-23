/**
 * BIO FLORAIS B2B — marketing ao lojista no link da oferta (C11): faixa no topo,
 * botão flutuante e pop-up do 1º acesso, em todas as páginas do link
 * (/b2b/oferta/<token> e /linha/<slug>). Só o B2B: o B2C não passa por aqui.
 */

import { Suspense, type ReactNode } from "react";

import LaunchModeMarker from "@/components/b2b/LaunchModeMarker";
import QuoteRestore from "@/components/b2b/QuoteRestore";
import RetailerMessages from "@/components/b2b/RetailerMessages";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { hasSeenPopup, loadActiveMessages, loadRotation } from "@/lib/b2b/retailer-messages";

export const dynamic = "force-dynamic";

export default async function OfferLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolution = await loadPublicB2BOfferContext(token);

  if (!resolution.ok) return <>{children}</>;

  const run = getAppSqlRunner();
  const [messages, seen, rotation] = await Promise.all([
    loadActiveMessages(run),
    hasSeenPopup(run, resolution.context.clientId),
    loadRotation(run),
  ]);

  return (
    <>
      {/* "Lançar pedido": faixa do modo lançamento (a autorização é do servidor, pela sessão do vendedor). */}
      <Suspense fallback={null}>
        <LaunchModeMarker token={token} />
      </Suspense>
      {/* "Continuar compra" de um orçamento: restaura a sacola na loja e guarda o rascunho para o checkout. */}
      <Suspense fallback={null}>
        <QuoteRestore token={token} />
      </Suspense>
      <RetailerMessages token={token} messages={messages} showPopup={!seen} rotation={rotation} />
      {children}
    </>
  );
}
