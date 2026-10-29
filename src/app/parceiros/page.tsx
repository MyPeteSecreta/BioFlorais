/**
 * BIO FLORAIS B2B — /parceiros: LOJA B2B pública (flyer da equipe comercial). Não é página de cadastro:
 * abre direto a vitrine do vendedor do link (?v=<código>) ou do vendedor da casa — a mesma experiência
 * do link do cliente (cards de linha, página da linha, sacola e checkout), com preço B2B normal e sem
 * promoção. A identificação do lojista acontece no checkout. noindex.
 * Sem vendedor disponível (nem ?v= nem vendedor da casa), só a apresentação e "Falar com um representante".
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import B2BHero from "@/components/b2b/B2BHero";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { resolvePartnerSeller, withForwardedParams } from "@/lib/b2b/partners";
import { findPromoLinkByCode, resolvePromoLinkTarget } from "@/lib/b2b/promo-links";
import { ensureStorefrontPath } from "@/lib/b2b/storefront";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Parceiros | Bio Florais",
  description: "Loja B2B da Bio Florais para lojistas.",
  robots: { index: false, follow: false, nocache: true },
};

function representativeUrl() {
  return process.env.B2B_DEMO_CTA_URL?.trim() || "https://wa.me/552139553713?text=Quero%20falar%20com%20um%20representante%20da%20Bio%20Florais";
}

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const v = Array.isArray(query.v) ? query.v[0] : query.v;
  const promo = Array.isArray(query.promo) ? query.promo[0] : query.promo;

  // Link com promoção (&promo=<código>): abre a vitrine da promoção; vencido abre a loja normal com o aviso.
  if (promo) {
    const link = await findPromoLinkByCode(getAppSqlRunner(), promo);
    const target = link ? await resolvePromoLinkTarget(getAppSqlRunner(), link) : null;

    if (target) redirect(withForwardedParams(target, query));
  }

  const { seller } = await resolvePartnerSeller(getAppSqlRunner(), v);
  const storePath = seller ? await ensureStorefrontPath(getAppSqlRunner(), { id: seller.id, name: seller.name }) : null;

  // A vitrine do vendedor É a loja: o token fica na URL, então a atribuição acompanha a navegação.
  // Os utm_* e demais parâmetros seguem para a loja (medição dos anúncios); só os internos (v, lancar) ficam.
  if (storePath) redirect(withForwardedParams(storePath, query));

  return (
    <main className="min-h-[70vh] bg-[#fffaf6] text-[#422347]">
      <B2BHero title="Preço de lojista" />
      <div className="mx-auto max-w-[760px] px-5 py-12 text-center">
        <p className="text-sm text-[#746471]">A loja B2B não está disponível por este endereço agora. Fale com um representante.</p>
        <a href={representativeUrl()} className="mt-6 inline-block rounded-full bg-[#55245f] px-7 py-4 text-base font-extrabold text-white shadow">
          Falar com um representante
        </a>
        <p className="mt-6 text-sm text-[#746471]">
          Já é cliente?{" "}
          <Link href="/b2b/entrar" className="font-bold text-[#63326d] underline" data-testid="ja-sou-cliente-parceiros">
            Já sou cliente
          </Link>
        </p>
      </div>
    </main>
  );
}
