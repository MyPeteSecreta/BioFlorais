/**
 * Carrinho abandonado (src/lib/cart-recovery.ts).
 *  GET  → { enabled }: o checkout só mostra a caixa de aceite com o recurso ligado e a tabela criada (SQL 56b).
 *  POST { email, name, items, consent } → consent=true grava a sacola; consent=false apaga (LGPD: retirar o aceite apaga na hora).
 * Nunca quebra o checkout: falha devolve 200 com ok=false.
 */

import { NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { cartTableReady, cleanEmail, loadCartRecoveryEnabled, removeCartByEmail, sanitizeCartItems, saveCartForRecovery } from "@/lib/cart-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const run = getAppSqlRunner();
    const enabled = (await cartTableReady(run)) && (await loadCartRecoveryEnabled(run));

    return NextResponse.json({ enabled }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; name?: unknown; items?: unknown; consent?: unknown };
  const email = cleanEmail(body.email);

  if (!email) return NextResponse.json({ ok: false, error: "E-mail inválido." }, { status: 400 });

  try {
    const run = getAppSqlRunner();

    if (!(await cartTableReady(run))) return NextResponse.json({ ok: false });

    if (body.consent !== true) {
      await removeCartByEmail(run, email);
      return NextResponse.json({ ok: true, result: "removed" });
    }

    if (!(await loadCartRecoveryEnabled(run))) return NextResponse.json({ ok: false });

    const result = await saveCartForRecovery(run, { email, name: String(body.name ?? ""), items: sanitizeCartItems(body.items) });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[cart/recovery] falha", error instanceof Error ? error.message : error);

    return NextResponse.json({ ok: false });
  }
}
