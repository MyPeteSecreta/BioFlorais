/**
 * ADMIN — folha do pedido/orçamento para imprimir ou salvar em PDF (a mesma folha do lojista). A sessão de admin é exigida
 * pelo layout do grupo (protected).
 */

import OrderPrintView, { OrderPrintUnavailable } from "@/components/b2b/OrderPrintView";
import { loadOrderSheet } from "@/lib/b2b/order-sheet";
import { getAppSqlRunner } from "@/lib/b2b/ownership";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminOrderSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const back = `/admin/pedidos/${id}`;
  const sheet = await loadOrderSheet(getAppSqlRunner(), id, null);

  if (!sheet) return <OrderPrintUnavailable backHref="/admin/pedidos" backLabel="Voltar aos pedidos" />;

  return <OrderPrintView sheet={sheet} backHref={back} backLabel="← Voltar ao pedido" />;
}
