/**
 * ADMIN B2B — comissões dos vendedores (C9): listar por vendedor/mês e marcar
 * como PAGA (com a data) ou desfazer. Só mexe em b2b_commission_payouts (SQL
 * 18b) e no log; pedidos e itens não são alterados.
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { isUuid } from "@/lib/b2b/admin-input";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadCommissionRows, totalsFor } from "@/lib/b2b/commissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const params = request.nextUrl.searchParams;
    const run = getAppSqlRunner();
    const rows = await loadCommissionRows(run, {
      responsibleId: params.get("vendedor"),
      month: params.get("mes"),
    });
    const responsibles = await run(`SELECT id, name FROM b2b_responsibles ORDER BY name`);

    return NextResponse.json({
      rows,
      totals: totalsFor(rows),
      responsibles: responsibles.map((row) => ({ id: String(row.id), name: String(row.name) })),
    });
  } catch (error) {
    console.error("[admin/b2b/commissions GET]", error);
    return NextResponse.json({ error: "Erro ao carregar as comissões." }, { status: 500 });
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      orderId?: string;
      installment?: number;
      paidAt?: string;
      note?: string;
      undo?: boolean;
    };
    const orderId = String(body.orderId ?? "");

    if (!isUuid(orderId)) {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    }

    const run = getAppSqlRunner();
    const note = body.note ? String(body.note).slice(0, 300) : null;
    // 0 = pedido inteiro (Pix/cartão); 1..N = parcela do boleto (C10).
    const installment = Number.isInteger(Number(body.installment)) && Number(body.installment) > 0 ? Number(body.installment) : 0;

    if (body.undo) {
      await run(`DELETE FROM b2b_commission_payouts WHERE order_id = $1 AND installment = $2`, [orderId, installment]);
      await run(
        `INSERT INTO b2b_commission_payout_log (order_id, action, note, created_by) VALUES ($1, 'undone', $2, 'admin')`,
        [orderId, installment > 0 ? `parcela ${installment}: ${note ?? ""}` : note]
      );
      return NextResponse.json({ ok: true });
    }

    const paidAt = String(body.paidAt ?? "");

    if (!DATE_RE.test(paidAt)) {
      return NextResponse.json({ error: "Informe a data do pagamento." }, { status: 400 });
    }

    // Só comissão de pedido B2B pago e não cancelado pode ser marcada como paga.
    const [order] = await run(`SELECT status, b2b_offer_id, payment_method FROM orders WHERE id = $1`, [orderId]);

    if (!order || !order.b2b_offer_id) {
      return NextResponse.json({ error: "Pedido B2B não encontrado." }, { status: 404 });
    }

    if (order.payment_method === "boleto") {
      // Boleto: a comissão é por parcela e só existe depois da BAIXA dela (nunca pelo vencimento).
      const [baixa] = await run(`SELECT 1 AS x FROM b2b_boleto_payments WHERE order_id = $1 AND installment = $2`, [orderId, installment]);

      if (installment < 1 || !baixa) {
        return NextResponse.json({ error: "A parcela do boleto ainda não tem baixa." }, { status: 409 });
      }
    } else if (order.status !== "paid") {
      return NextResponse.json(
        { error: "Só pedidos B2B pagos podem ter a comissão marcada como paga." },
        { status: 409 }
      );
    }

    await run(
      `INSERT INTO b2b_commission_payouts (order_id, installment, paid_at, note, created_by) VALUES ($1, $2, $3::date, $4, 'admin')
       ON CONFLICT (order_id, installment) DO UPDATE SET paid_at = EXCLUDED.paid_at, note = EXCLUDED.note`,
      [orderId, installment, paidAt, note]
    );
    await run(
      `INSERT INTO b2b_commission_payout_log (order_id, action, paid_at, note, created_by) VALUES ($1, 'paid', $2::date, $3, 'admin')`,
      [orderId, paidAt, installment > 0 ? `parcela ${installment}${note ? `: ${note}` : ""}` : note]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/b2b/commissions POST]", error);
    return NextResponse.json({ error: "Erro ao salvar (o SQL 18b foi aplicado?)." }, { status: 500 });
  }
}
