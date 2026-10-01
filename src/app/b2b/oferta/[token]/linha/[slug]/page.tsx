/**
 * BIO FLORAIS B2B — linha FORA da oferta, aberta pelo cliente a partir
 * do link da oferta. Mostra os produtos SEM preço (a linha não faz parte
 * da oferta) e um botão para pedir a linha ao vendedor. A visita é
 * registrada por <RecordLineView/> (POST depois de montar).
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { findOtherB2BLine, loadLineProducts } from "@/lib/b2b/line-views";
import { buildWhatsAppUrl } from "@/lib/b2b/invite-links";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { getProduct } from "@/lib/catalog/bio-products";
import { getProductMainImage } from "@/lib/catalog/product-images.server";
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

  const lineProducts = await loadLineProducts(line.id);

  const whatsappUrl = buildWhatsAppUrl(
    context.responsiblePhone,
    `Olá, ${context.responsibleName}! Aqui é ${context.clientDisplayName}. Vi a linha ${line.name} da Bio Florais e gostaria de incluí-la na minha oferta.`
  );

  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-10 text-[#422347]">
      <RecordLineView token={token} lineSlug={line.slug} />

      <div className="mx-auto max-w-[1180px] lg:px-5">
        <Link href={offerHref} className="text-sm font-bold text-[#63326d] underline underline-offset-4">
          ← Voltar à minha oferta
        </Link>

        <h1 className="mt-4 font-serif text-3xl font-semibold text-[#55245f]">{line.name}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#746471]">
          Esta linha não faz parte da sua oferta atual, por isso os preços não aparecem aqui.
          Peça ao seu representante para incluí-la.
        </p>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-full bg-[#1f9d55] px-5 py-3 text-sm font-extrabold text-white"
        >
          Pedir esta linha ao representante
        </a>

        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {lineProducts.map((product) => {
            const catalogProduct = getProduct(product.slug);
            const image = catalogProduct ? getProductMainImage(catalogProduct) || null : null;

            return (
              <li key={product.id} className="rounded-[20px] border border-[#eadfd9] bg-white p-4">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-[#fbf5f1]">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={product.name} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-[#9c8c98]">Sem imagem</span>
                  )}
                </div>
                <p className="mt-3 text-sm font-bold">{product.name}</p>
                {catalogProduct?.content && (
                  <p className="mt-1 text-xs text-[#8a7886]">{catalogProduct.content}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
