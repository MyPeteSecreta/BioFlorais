/** "Não quero mais receber" do e-mail da sacola: apaga a sacola guardada (link assinado, sem dado pessoal na URL). */

import { NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { cartTableReady, removeCartById } from "@/lib/cart-recovery";
import { verifyTrackingToken } from "@/lib/order-tracking";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const id = verifyTrackingToken(String(body.token ?? ""));

  if (!id) return NextResponse.json({ ok: false, error: "Link inválido." }, { status: 400 });

  const run = getAppSqlRunner();

  if (!(await cartTableReady(run))) return NextResponse.json({ ok: true });

  await removeCartById(run, id);

  return NextResponse.json({ ok: true });
}
