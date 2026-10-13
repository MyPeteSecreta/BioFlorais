/**
 * ADMIN B2B — configuração do MOSTRUÁRIO do vendedor/RCA.
 *
 *   GET   configuração (percentual, janela, grupos) + pedidos de mostruário
 *   POST  { action: "save_settings", percent, windowDays }
 *         { action: "save_group", id?, name, lineSlugs, categories, nameIncludes, nameExcludes,
 *           limitQty, perLine, lowestVolumeOnly, active }   (sem id = grupo novo, DESATIVADO por padrão)
 *         { action: "delete_group", id }
 * Tudo validado no servidor; o pedido do vendedor revalida de novo com esta mesma configuração.
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { isUuid } from "@/lib/b2b/admin-input";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import {
  SHOWCASE_ORIGIN,
  loadShowcaseConfig,
  parseShowcasePercent,
  parseShowcaseWindowDays,
} from "@/lib/b2b/showcase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

function list(value: unknown, max = 40): string[] {
  const items = Array.isArray(value) ? value : String(value ?? "").split(/[,;\n]/);
  const out: string[] = [];

  for (const item of items) {
    const text = String(item ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= max) break;
  }

  return out;
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const run = getAppSqlRunner();
    const config = await loadShowcaseConfig(run);

    let orders: Array<Record<string, unknown>> = [];

    try {
      const rows = await run(
        `SELECT o.id, o.status, o.total_cents, o.subtotal_cents, o.shipping_cents, o.payment_method,
                to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
                COALESCE(r.name, o.b2b_responsible_name) AS seller,
                (SELECT coalesce(sum(i.qty), 0)::int FROM order_items i WHERE i.order_id = o.id) AS items
           FROM orders o LEFT JOIN b2b_responsibles r ON r.id = o.b2b_responsible_id
          WHERE to_jsonb(o) ->> 'origin' = $1
          ORDER BY o.created_at DESC LIMIT 200`,
        [SHOWCASE_ORIGIN]
      );
      orders = rows.map((row) => ({
        id: String(row.id),
        status: String(row.status),
        totalCents: Number(row.total_cents ?? 0),
        subtotalCents: Number(row.subtotal_cents ?? 0),
        shippingCents: Number(row.shipping_cents ?? 0),
        paymentMethod: row.payment_method ? String(row.payment_method) : null,
        createdAt: String(row.created_at),
        seller: row.seller ? String(row.seller) : null,
        items: Number(row.items ?? 0),
      }));
    } catch {
      // SQL 37b ausente: lista vazia.
    }

    return NextResponse.json({ ok: true, ...config, orders });
  } catch (error) {
    console.error("[admin/b2b/showcase GET]", error);
    return bad("Erro ao carregar o mostruário.", 500);
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const run = getAppSqlRunner();

    if (body.action === "save_settings") {
      const percent = parseShowcasePercent(body.percent);
      const windowDays = parseShowcaseWindowDays(body.windowDays);

      if (percent === null) return bad("Informe o percentual do preço de mostruário (de 1 a 100).");
      if (windowDays === null) return bad("Informe a janela em dias (de 1 a 365).");

      for (const [key, value] of [
        ["showcase_price_percent", String(percent)],
        ["showcase_window_days", String(windowDays)],
      ] as const) {
        await run(
          `INSERT INTO b2b_settings (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [key, value]
        );
      }

      return NextResponse.json({ ok: true, percent, windowDays });
    }

    if (body.action === "save_group") {
      const name = String(body.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
      const limitQty = Number(body.limitQty);
      const lineSlugs = list(body.lineSlugs);
      const categories = list(body.categories);

      if (name.length < 2) return bad("Informe o nome do grupo.");
      if (!Number.isInteger(limitQty) || limitQty < 0 || limitQty > 99) return bad("O limite por janela vai de 0 a 99.");
      if (lineSlugs.length === 0 && categories.length === 0) {
        return bad("Informe ao menos uma linha ou uma categoria para o grupo.");
      }

      const values = [
        name,
        lineSlugs,
        categories,
        list(body.nameIncludes),
        list(body.nameExcludes),
        limitQty,
        body.perLine === true,
        body.lowestVolumeOnly !== false,
      ];

      if (body.id !== undefined && body.id !== null && body.id !== "") {
        const id = String(body.id);
        if (!isUuid(id)) return bad("Grupo inválido.");

        const rows = await run(
          `UPDATE b2b_showcase_groups
              SET name = $2, line_slugs = $3::text[], categories = $4::text[], name_includes = $5::text[],
                  name_excludes = $6::text[], limit_qty = $7::int, per_line = $8::boolean,
                  lowest_volume_only = $9::boolean, active = $10::boolean, updated_at = now()
            WHERE id = $1::uuid RETURNING id`,
          [id, ...values, body.active === true]
        );

        if (rows.length === 0) return bad("Grupo não encontrado.", 404);
        return NextResponse.json({ ok: true, id });
      }

      // Grupo novo entra DESATIVADO: o admin confere e ativa.
      const [created] = await run(
        `INSERT INTO b2b_showcase_groups
           (name, line_slugs, categories, name_includes, name_excludes, limit_qty, per_line, lowest_volume_only, active, sort_order)
         VALUES ($1, $2::text[], $3::text[], $4::text[], $5::text[], $6::int, $7::boolean, $8::boolean, false,
                 COALESCE((SELECT max(sort_order) + 1 FROM b2b_showcase_groups), 0))
         RETURNING id`,
        values
      );

      return NextResponse.json({ ok: true, id: String(created.id) });
    }

    if (body.action === "delete_group") {
      const id = String(body.id ?? "");
      if (!isUuid(id)) return bad("Grupo inválido.");
      // Pedidos antigos não dependem do grupo (a regra é recalculada com a configuração atual).
      await run(`DELETE FROM b2b_showcase_groups WHERE id = $1::uuid`, [id]);
      return NextResponse.json({ ok: true });
    }

    return bad("Ação inválida.");
  } catch (error) {
    console.error("[admin/b2b/showcase POST]", error);
    return bad("Erro ao salvar o mostruário (o SQL 39b foi aplicado?).", 500);
  }
}
