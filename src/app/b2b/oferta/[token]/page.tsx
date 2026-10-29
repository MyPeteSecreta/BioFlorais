/**
 * BIO FLORAIS B2B — página pública da oferta. O token é validado no
 * servidor antes de mostrar qualquer linha/preço; sem cache, para que
 * uma oferta revogada pare de funcionar na hora.
 *
 * Primeira tela = cards de linha (mesma arte da Home do B2C). As linhas
 * escolhidas pelo vendedor vêm primeiro, com moldura azul e selo da
 * promoção; abaixo, "Outras linhas" (preço B2B normal, sem promoção).
 * Clicar numa linha abre os produtos em /b2b/oferta/<token>/linha/<slug>.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import B2BHero from "@/components/b2b/B2BHero";
import B2BLineCard from "@/components/b2b/B2BLineCard";
import DisplayStrip from "@/components/b2b/DisplayStrip";
import { displayPhotoUrl, lineSlugsWithDisplay, loadDisabledDisplays } from "@/lib/b2b/displays-server";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { demoCtaUrl } from "@/lib/b2b/demo";
import { loadOtherB2BLines } from "@/lib/b2b/line-views";
import { homeLineImage } from "@/lib/b2b/line-images";
import { describeScope } from "@/lib/b2b/product-label";
import { lineBadge, lineEligibilityCaption } from "@/lib/b2b/offer-notices";
import { listOfferPromotionNotices } from "@/lib/b2b/promotion-resolver";
import { PROMO_ENDED_NOTICE } from "@/lib/b2b/promo-link-core";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "Este link de oferta não existe.",
  link_revoked_or_expired: "Este link de oferta expirou ou foi substituído por um novo.",
  offer_not_active: "Esta oferta não está mais ativa.",
  promo_link_ended: "Esta promoção terminou.",
  client_relationship_inactive: "Esta oferta não está mais disponível.",
};

function Unavailable({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]">
      <h1 className="font-serif text-3xl font-semibold text-[#55245f]">Link indisponível</h1>
      <p className="mx-auto mt-3 max-w-md text-[#746471]">{message}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#746471]">
        Fale com o seu representante Bio Florais para receber um novo link.
      </p>
    </main>
  );
}

export default async function B2BOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const notice = Array.isArray(query.aviso) ? query.aviso[0] : query.aviso;
  // Token base64url: não precisa de decodificação.
  const resolution = await loadPublicB2BOfferContext(token);

  if (!resolution.ok) {
    // Promoção do link vencida/revogada: abre a loja normal com o aviso "esta promoção terminou".
    if (resolution.error === "promo_link_ended" && resolution.promoRedirect) redirect(resolution.promoRedirect);

    return <Unavailable message={ERROR_MESSAGES[resolution.error]} />;
  }

  const { context } = resolution;
  const [notices, otherLines, disabledDisplays] = await Promise.all([
    listOfferPromotionNotices(context.offerId, context.clientId),
    loadOtherB2BLines(context),
    loadDisabledDisplays(getAppSqlRunner()),
  ]);
  // Linhas com display ligado (selo "Com display") e faixa do kit compacto do Adulto.
  const displayLines = lineSlugsWithDisplay(disabledDisplays);
  const showCompactStrip =
    !disabledDisplays.has("adulto-compacto") &&
    [...context.commercialGroups, ...otherLines].some((group) => group.slug === "adulto");

  // Aviso ÚNICO do alcance por produto, por linha ("Oferta válida para os sabonetes líquidos").
  const scopeTextOfLine = (lineId: string) => {
    const ids = new Set(notices.filter((item) => item.commercialGroupId === lineId).flatMap((item) => item.productIds));
    return describeScope(
      context.products.filter((product) => product.commercialGroupIds.includes(lineId) && ids.has(product.id))
    );
  };
  const lineHref = (slug: string) => `/b2b/oferta/${encodeURIComponent(token)}/linha/${encodeURIComponent(slug)}`;

  // Linha da oferta sem nenhum produto liberado não vira card.
  const offerLines = context.commercialGroups.filter((group) =>
    context.products.some((product) => product.commercialGroupIds.includes(group.id))
  );

  if (offerLines.length === 0 && otherLines.length === 0) {
    return <Unavailable message="Esta oferta ainda não tem produtos liberados." />;
  }

  const store = context.isStorefront;

  return (
    <main className="min-h-screen bg-[#fffaf6] pb-16 text-[#422347]">
      <B2BHero
        title="Preço de lojista"
        subtitle={store ? null : `Oferta para ${context.clientDisplayName} · atendido por ${context.responsibleName}`}
      >
        {store && (
          <Link href="/b2b/entrar" className="rounded-full bg-[#55245f] px-4 py-2 text-xs font-extrabold text-white" data-testid="ja-sou-cliente-loja">
            Já sou cliente
          </Link>
        )}
        {!store && (
          <Link
            href={`/b2b/oferta/${encodeURIComponent(token)}/pedidos`}
            className="rounded-full bg-[#55245f] px-4 py-2 text-xs font-extrabold text-white"
          >
            Meus pedidos
          </Link>
        )}
        <Link
          href="/acompanhe-seu-pedido"
          className="rounded-full border border-[#55245f] bg-white px-4 py-2 text-xs font-extrabold text-[#55245f]"
        >
          Acompanhar pedido
        </Link>
      </B2BHero>

      <div className="mx-auto max-w-[1180px] px-5 py-8 lg:px-10">
        {context.promoLink && (
          <p role="status" className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-950" data-testid="aviso-promocao-link">
            Promoção: {context.promoLink.name}
            {context.promoLink.expiresAt
              ? ` · válida até ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(context.promoLink.expiresAt)}`
              : ""}
          </p>
        )}
        {store && !context.promoLink && notice === PROMO_ENDED_NOTICE && (
          <p role="status" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950" data-testid="aviso-promocao-terminou">
            Esta promoção terminou. Veja abaixo as linhas com o preço B2B normal.
          </p>
        )}
        {showCompactStrip && (
          <DisplayStrip
            href={`/b2b/oferta/${encodeURIComponent(token)}/linha/adulto?kit=adulto-compacto`}
            photo={displayPhotoUrl("adulto-compacto")}
            fallbackImage={homeLineImage("adulto")}
          />
        )}

        {offerLines.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#55245f]">{store ? "Nossas linhas" : "Sua oferta"}</h2>
            <p className="mt-1 text-sm text-[#746471]">
              {store
                ? "Toque numa linha para ver os produtos com o preço B2B."
                : "Linhas escolhidas pelo seu representante. Toque numa linha para ver os produtos."}
            </p>
            <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
              {offerLines.map((line) => (
                <B2BLineCard
                  key={line.id}
                  href={lineHref(line.slug)}
                  name={line.name}
                  image={homeLineImage(line.slug)}
                  highlight
                  withDisplay={displayLines.has(line.slug)}
                  badge={lineBadge(notices, line.id, scopeTextOfLine(line.id)) ?? "Preço B2B"}
                  caption={lineEligibilityCaption(notices, line.id) ?? undefined}
                />
              ))}
            </div>
          </section>
        )}

        {otherLines.length > 0 && (
          <section className={offerLines.length > 0 ? "mt-12" : ""}>
            <h2 className="font-serif text-2xl font-semibold text-[#55245f]">Outras linhas</h2>
            <p className="mt-1 text-sm text-[#746471]">
              Fique atento às campanhas. Pergunte ao seu representante.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {otherLines.map((line) => (
                <B2BLineCard
                  key={line.id}
                  href={lineHref(line.slug)}
                  name={line.name}
                  image={homeLineImage(line.slug)}
                  withDisplay={displayLines.has(line.slug)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {store && (
        <p className="mx-auto mt-6 max-w-[1180px] px-5 text-center text-xs text-[#8a7886] lg:px-10">
          Quer vender Bio Florais?{" "}
          <a href={demoCtaUrl(process.env.B2B_DEMO_CTA_URL)} className="font-bold underline">
            Quero ser representante
          </a>
        </p>
      )}
    </main>
  );
}
