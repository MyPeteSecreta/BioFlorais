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

import B2BLineCard from "@/components/b2b/B2BLineCard";
import { loadOtherB2BLines } from "@/lib/b2b/line-views";
import { homeLineImage } from "@/lib/b2b/line-images";
import { lineBadge, lineEligibilityCaption } from "@/lib/b2b/offer-notices";
import { listOfferPromotionNotices } from "@/lib/b2b/promotion-resolver";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";

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
  const [notices, otherLines] = await Promise.all([
    listOfferPromotionNotices(context.offerId, context.clientId),
    loadOtherB2BLines(context),
  ]);

  const productNameById = new Map(context.products.map((product) => [product.id, product.name]));
  const lineHref = (slug: string) => `/b2b/oferta/${encodeURIComponent(token)}/linha/${encodeURIComponent(slug)}`;

  // Linha da oferta sem nenhum produto liberado não vira card.
  const offerLines = context.commercialGroups.filter((group) =>
    context.products.some((product) => product.commercialGroupIds.includes(group.id))
  );

  if (offerLines.length === 0 && otherLines.length === 0) {
    return <Unavailable message="Esta oferta ainda não tem produtos liberados." />;
  }

  return (
    <main className="min-h-screen bg-[#fffaf6] pb-16 text-[#422347]">
      <header className="border-b border-[#eadfd9] bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-6 lg:px-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#9b6c24]">
            Bio Florais · Área B2B
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-[#55245f]">
            Oferta para {context.clientDisplayName}
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#6c5b69]">
            Atendido por {context.responsibleName}
          </p>
          <p className="mt-3 inline-block rounded-full border border-[#eadfd9] bg-[#fffaf6] px-4 py-2 text-xs font-bold text-[#6c5b69]">
            Pedido mínimo R$ 250,00 em produtos · Frete especial B2B a partir de R$ 450
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-5 py-8 lg:px-10">
        {offerLines.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#55245f]">Sua oferta</h2>
            <p className="mt-1 text-sm text-[#746471]">
              Linhas escolhidas pelo seu representante. Toque numa linha para ver os produtos.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
              {offerLines.map((line) => (
                <B2BLineCard
                  key={line.id}
                  href={lineHref(line.slug)}
                  name={line.name}
                  image={homeLineImage(line.slug)}
                  highlight
                  badge={lineBadge(notices, line.id, productNameById) ?? "Preço B2B"}
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
              Preço B2B normal, sem promoção. Quer uma condição especial? Pergunte ao seu representante.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {otherLines.map((line) => (
                <B2BLineCard
                  key={line.id}
                  href={lineHref(line.slug)}
                  name={line.name}
                  image={homeLineImage(line.slug)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
