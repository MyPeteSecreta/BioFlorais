/**
 * Folha do pedido/orçamento SEM token: para o representante logado (painel, "Lançar pedido"). O acesso é pela sessão B2B
 * (order-access.ts): só os pedidos dele.
 */

import { cookies } from "next/headers";

import OrderPrintView, { OrderPrintUnavailable } from "@/components/b2b/OrderPrintView";
import { authorizeOrderView } from "@/lib/b2b/order-access";
import { loadOrderSheet } from "@/lib/b2b/order-sheet";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { B2B_SESSION_COOKIE } from "@/lib/b2b/responsible-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function VendorPrintOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const run = getAppSqlRunner();
  const jar = await cookies();
  const access = await authorizeOrderView(run, { orderId, sessionCookie: jar.get(B2B_SESSION_COOKIE)?.value ?? null });

  if (!access.ok) return <OrderPrintUnavailable backHref="/b2b/login" backLabel="Entrar como representante" />;

  const sheet = await loadOrderSheet(run, orderId, null);

  if (!sheet) return <OrderPrintUnavailable backHref="/b2b/painel" backLabel="Voltar ao painel" />;

  return <OrderPrintView sheet={sheet} backHref="/b2b/painel" backLabel="← Meu painel" />;
}
