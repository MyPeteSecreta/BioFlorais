/**
 * BIO FLORAIS B2B — página pública da oferta. O token é validado no
 * servidor antes de mostrar qualquer produto/preço; sem cache, para que
 * uma oferta revogada pare de funcionar na hora.
 */

import Link from "next/link";

import { loadOtherB2BLines } from "@/lib/b2b/line-views";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { resolveB2BUnitPriceCents } from "@/lib/b2b/pricing";
import { listOfferPromotionNotices, type B2BOfferPromotionNotice } from "@/lib/b2b/promotion-resolver";
import { getProduct } from "@/lib/catalog/bio-products";
import { getProductMainImage } from "@/lib/catalog/product-images.server";
import B2BOfferCatalog, { type B2BCatalogGroup } from "@/components/b2b/B2BOfferCatalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "Este link de oferta não existe.",
  link_revoked_or_expired: "Este link de oferta expirou ou foi substituído por um novo.",
  offer_not_active: "Esta oferta não está mais ativa.",
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
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Token base64url: não precisa de decodificação.
  const resolution = await loadPublicB2BOfferContext(token);

  if (!resolution.ok) {
    return <Unavailable message={ERROR_MESSAGES[resolution.error]} />;
  }

  const { context } = resolution;

  const notices = await listOfferPromotionNotices(context.offerId);

  const groups: B2BCatalogGroup[] = context.commercialGroups
    .map((group) => ({
      id: group.id,
      name: group.name,
      promotionNote: promotionNote(notices, group.id),
      products: context.products
        .filter((product) => product.commercialGroupIds.includes(group.id))
        .map((product) => {
          const catalogProduct = getProduct(product.slug);

          return {
            id: product.id,
            slug: product.slug,
            name: product.name,
            content: catalogProduct?.content ?? null,
            image: catalogProduct ? getProductMainImage(catalogProduct) || null : null,
            priceCents: resolveB2BUnitPriceCents(product.b2cPriceCents, product.category),
            promotionText: promotionText(notices, group.id, product.id),
          };
        }),
    }))
    .filter((group) => group.products.length > 0);

  if (groups.length === 0) {
    return <Unavailable message="Esta oferta ainda não tem produtos liberados." />;
  }

  const otherLines = await loadOtherB2BLines(context);

  return (
    <main className="min-h-screen bg-[#fffaf6] pb-32 text-[#422347]">
      <header className="border-b border-[#eadfd9] bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-6 lg:px-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#9b6c24]">
            Bio Florais · Área B2B
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-[#55245f]">
            Oferta para {context.clientDisplayName}
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#6c5b69]">
            Atendimento: {context.responsibleName}
          </p>
        </div>
      </header>

      <B2BOfferCatalog token={token} groups={groups} />

      {otherLines.length > 0 && (
        <section className="mx-auto max-w-[1180px] px-5 pb-10 lg:px-10">
          <h2 className="font-serif text-2xl font-semibold text-[#55245f]">Outras linhas Bio Florais</h2>
          <p className="mt-1 text-sm text-[#746471]">
            Estas linhas não fazem parte desta oferta, mas você pode comprar pelo preço B2B
            normal, sem promoção. Quer uma condição especial? Peça ao seu representante.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {otherLines.map((line) => (
              <Link
                key={line.id}
                href={`/b2b/oferta/${encodeURIComponent(token)}/linha/${encodeURIComponent(line.slug)}`}
                prefetch={false}
                className="rounded-full border border-[#d9c7dc] bg-white px-4 py-2 text-sm font-bold text-[#63326d] hover:border-[#63326d]"
              >
                {line.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function bonusLabel(buy: number, free: number) {
  return `Compre ${buy} e leve +${free} grátis do mesmo produto`;
}

/** Aviso da linha inteira (promoção sem produtos explícitos). */
function promotionNote(notices: B2BOfferPromotionNotice[], groupId: string) {
  const wide = notices.find((item) => item.commercialGroupId === groupId && item.productIds.length === 0);
  return wide ? `Promoção nesta linha: ${bonusLabel(wide.buyQuantity, wide.freeQuantity)}.` : null;
}

/** Aviso por produto (linha inteira ou promoção pontual por SKU). */
function promotionText(notices: B2BOfferPromotionNotice[], groupId: string, productId: string) {
  const match = notices.find(
    (item) =>
      item.commercialGroupId === groupId &&
      (item.productIds.length === 0 || item.productIds.includes(productId))
  );
  return match ? bonusLabel(match.buyQuantity, match.freeQuantity) : null;
}
