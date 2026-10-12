/**
 * BIO FLORAIS B2B — /parceiros: LOJA B2B pública (flyer da equipe comercial). Não é página de cadastro:
 * abre direto a vitrine do vendedor do link (?v=<código>) ou do vendedor da casa — a mesma experiência
 * do link do cliente (cards de linha, página da linha, sacola e checkout), com preço B2B normal e sem
 * promoção. A identificação do lojista acontece no checkout. noindex.
 * Sem vendedor disponível (nem ?v= nem vendedor da casa), só a apresentação e "Falar com um representante".
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { resolvePartnerSeller } from "@/lib/b2b/partners";
import { B2B_MIN_ORDER_CENTS } from "@/lib/b2b/pricing";
import { ensureStorefrontPath } from "@/lib/b2b/storefront";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Parceiros | Bio Florais",
  description: "Loja B2B da Bio Florais para lojistas.",
  robots: { index: false, follow: false, nocache: true },
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function representativeUrl() {
  return process.env.B2B_DEMO_CTA_URL?.trim() || "https://wa.me/552139553713?text=Quero%20falar%20com%20um%20representante%20da%20Bio%20Florais";
}

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const { seller } = await resolvePartnerSeller(getAppSqlRunner(), v);
  const storePath = seller ? await ensureStorefrontPath(getAppSqlRunner(), { id: seller.id, name: seller.name }) : null;

  // A vitrine do vendedor É a loja: o token fica na URL, então a atribuição acompanha a navegação.
  if (storePath) redirect(storePath);

  return (
    <main className="min-h-[70vh] bg-[#fffdf9] px-5 py-16 text-[#2f2231] lg:px-10">
      <div className="mx-auto max-w-[760px] text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9b6c24]">Bio Florais · Desde 1997</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-[#422347] sm:text-5xl">Preço de lojista</h1>
        <p className="mt-4 text-lg leading-8 text-[#665765]">
          Pedido mínimo {money(B2B_MIN_ORDER_CENTS)} · frete especial B2B a partir de R$ 450 · Pix, cartão em até 3x e boleto PJ.
        </p>
        <p className="mt-6 text-sm text-[#746471]">A loja B2B não está disponível por este endereço agora. Fale com um representante.</p>
        <a href={representativeUrl()} className="mt-6 inline-block rounded-full bg-[#55245f] px-7 py-4 text-base font-extrabold text-white shadow">
          Falar com um representante
        </a>
      </div>
    </main>
  );
}
