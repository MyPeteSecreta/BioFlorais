/**
 * ADMIN B2B — "Boletos a receber" (C10): lista por PARCELA (com filtros) e
 * baixa/desfazer baixa. A baixa alimenta a comissão da parcela (dia 10 do mês
 * seguinte à data da baixa) e o status do pedido (todas baixadas = Pago).
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { andNotArchived } from "@/lib/b2b/archive";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import {
  giveBaixa,
  loadBoletoInstallments,
  undoBaixa,
  type InstallmentStatus,
} from "@/lib/b2b/boleto-installments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["aberto", "vencido", "pago", "cancelado"];

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const params = request.nextUrl.searchParams;
    const status = params.get("situacao") ?? "";
    const run = getAppSqlRunner();

    const installments = await loadBoletoInstallments(run, {
      status: STATUSES.includes(status) ? (status as InstallmentStatus) : null,
      dueFrom: params.get("de"),
      dueTo: params.get("ate"),
      clientId: params.get("cliente"),
      responsibleId: params.get("vendedor"),
    });

    const [clients, responsibles] = await Promise.all([
      run(`SELECT id, display_name FROM b2b_clients WHERE TRUE${await andNotArchived(run, "b2b_clients")} ORDER BY display_name`),
      run(`SELECT id, name FROM b2b_responsibles WHERE TRUE${await andNotArchived(run, "b2b_responsibles")} ORDER BY name`),
    ]);

    return NextResponse.json({
      installments,
      clients: clients.map((row) => ({ id: String(row.id), name: String(row.display_name) })),
      responsibles: responsibles.map((row) => ({ id: String(row.id), name: String(row.name) })),
    });
  } catch (error) {
    console.error("[admin/b2b/boletos GET]", error);
    return NextResponse.json({ error: "Erro ao carregar os boletos (o SQL 20b foi aplicado?)." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      orderId?: string;
      installment?: number;
      paidAt?: string;
      paidCents?: number | null;
      note?: string;
      reason?: string;
    };
    const run = getAppSqlRunner();
    const orderId = String(body.orderId ?? "");
    const installment = Number(body.installment);

    if (body.action === "baixa") {
      const result = await giveBaixa(run, {
        orderId,
        installment,
        paidAt: String(body.paidAt ?? ""),
        paidCents: body.paidCents === null || body.paidCents === undefined ? null : Number(body.paidCents),
        note: body.note ? String(body.note).slice(0, 300) : null,
      });

      return result.ok
        ? NextResponse.json({ ok: true, orderPaid: result.orderPaid })
        : NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (body.action === "undo") {
      const result = await undoBaixa(run, { orderId, installment, reason: String(body.reason ?? "").slice(0, 300) });

      return result.ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    console.error("[admin/b2b/boletos POST]", error);
    return NextResponse.json({ error: "Erro ao salvar a baixa." }, { status: 500 });
  }
}
