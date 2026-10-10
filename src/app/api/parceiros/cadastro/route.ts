/**
 * BIO FLORAIS B2B — L3: cadastro rápido do LOJISTA na página pública /parceiros.
 * Cria (ou reaproveita) o cliente ligado ao vendedor do link (?v=) ou ao vendedor da casa e abre o
 * link padrão (L1: todas as linhas B2B, preço B2B normal, sem promoção). Público; protegido por
 * campo-isca, limite por IP e validação de CNPJ/CPF. Sem vendedor disponível, não cadastra.
 */

import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { createLeadClient, findExistingLead, parseLead, resolvePartnerSeller } from "@/lib/b2b/partners";
import { createActiveOffer, evaluateStandardOffer } from "@/lib/b2b/quick-offer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const key = createHash("sha256").update(ip).digest("hex");
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);

  recent.push(now);
  hits.set(key, recent);

  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // Campo-isca: robô preenche, pessoa não vê. Responde "ok" sem fazer nada.
    if (String(body.website ?? "").trim() !== "") return NextResponse.json({ ok: true });

    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sem-ip";

    if (limited(ip)) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." }, { status: 429 });
    }

    const parsed = parseLead(body);

    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const run = getAppSqlRunner();
    const { seller, via } = await resolvePartnerSeller(run, body.v);

    if (!seller) {
      return NextResponse.json({ error: "O cadastro por esta página não está disponível agora. Fale com um representante." }, { status: 409 });
    }

    const client =
      (await findExistingLead(run, seller.id, parsed.value)) ??
      (await createLeadClient(run, seller.id, parsed.value, { referralCode: seller.referralCode, via }));

    const standard = await evaluateStandardOffer(client.id);

    if (standard.commercialGroupIds.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha B2B disponível no momento. Fale com um representante." }, { status: 409 });
    }

    const result = await createActiveOffer(run, {
      responsible: { id: seller.id, name: seller.name },
      client,
      commercialGroupIds: standard.commercialGroupIds,
      promotions: [],
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ ok: true, url: result.url });
  } catch (error) {
    console.error("[parceiros/cadastro]", error);
    return NextResponse.json({ error: "Não foi possível concluir o cadastro agora. Tente novamente." }, { status: 500 });
  }
}
