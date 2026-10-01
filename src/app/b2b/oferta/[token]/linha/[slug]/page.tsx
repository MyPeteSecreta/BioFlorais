/**
 * BIO FLORAIS B2B — linha FORA da oferta, aberta pelo cliente a partir do
 * link da oferta. O cliente VÊ e COMPRA pelo PREÇO B2B NORMAL, sem
 * promoção (decisão do Luis, 01/10). A visita é registrada por
 * <RecordLineView/> (POST depois de montar) e o botão de WhatsApp pede ao
 * vendedor uma oferta com a linha.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { findOtherB2BLine, loadOtherLineProducts } from "@/lib/b2b/line-views";
import { buildWhatsAppUrl } from "@/lib/b2b/invite-links";
import { resolveB2BUnitPriceCents } from "@/lib/b2b/pricing";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { getProduct } from "@/lib/catalog/bio-products";
import { getProductMainImage } from "@/lib/catalog/product-images.server";
import B2BOfferCatalog from "@/components/b2b/B2BOfferCatalog";
import RecordLineView from "./RecordLineView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function B2BOtherLinePage({
  params,
}: {
  params: Promise<{ token: string; slug: string }>;
}) {
  const { token, slug } = await params;
  const resolution = await loadPublicB2BOfferContext(token);

  if (!resolution.ok) {
    notFound();
  }

  const { context } = resolution;
  const offerHref = `/b2b/oferta/${encodeURIComponent(token)}`;
  const line = await findOtherB2BLine(context, slug);

  if (!line) {
    // Linha inexistente, inativa ou que já está na oferta.
    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]">
        <p>Esta linha não está disponível.</p>
        <Link href={offerHref} className="mt-4 inline-block text-sm font-bold text-[#63326d] underline">
          Voltar à oferta
        </Link>
      </main>
    );
  }

  const lineProducts = await loadOtherLineProducts(context, line.id);

  const whatsappUrl = buildWhatsAppUrl(
    context.responsiblePhone,
    `Olá, ${context.responsibleName}! Aqui é ${context.clientDisplayName}. Vi a linha ${line.name} da Bio Florais e gostaria de uma oferta com ela.`
  );

  return (
    <main className="min-h-screen bg-[#fffaf6] pb-32 text-[#422347]">
      <RecordLineView token={token} lineSlug={line.slug} />

      <header className="border-b border-[#eadfd9] bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-6 lg:px-10">
          <Link href={offerHref} className="text-sm font-bold text-[#63326d] underline underline-offset-4">
            ← Voltar à minha oferta
          </Link>
          <h1 className="mt-3 font-serif text-3xl font-semibold text-[#55245f]">{line.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#746471]">
            Esta linha não faz parte da sua oferta: você pode comprar pelo preço B2B normal, sem
            promoção. Quer uma condição especial? Peça ao seu representante.
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-full bg-[#1f9d55] px-5 py-3 text-sm font-extrabold text-white"
          >
            Pedir oferta desta linha ao representante
          </a>
        </div>
      </header>

      {lineProducts.length === 0 ? (
        <p className="mx-auto max-w-[1180px] px-5 py-10 text-[#746471] lg:px-10">
          Nenhum produto disponível nesta linha no momento.
        </p>
      ) : (
        <B2BOfferCatalog
          token={token}
          groups={[
            {
              id: line.id,
              name: `${line.name} · preço B2B normal`,
              products: lineProducts.map((product) => {
                const catalogProduct = getProduct(product.slug);

                return {
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  content: catalogProduct?.content ?? null,
                  image: catalogProduct ? getProductMainImage(catalogProduct) || null : null,
                  priceCents: resolveB2BUnitPriceCents(product.b2cPriceCents, product.category),
                };
              }),
            },
          ]}
        />
      )}
    </main>
  );
}
