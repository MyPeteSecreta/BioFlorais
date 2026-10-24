/**
 * Página de campanha do ChatGPT Ads (/para/<slug>), Rodada 20: UM modelo, 8 páginas, dados em src/lib/campaign/gpt-pages.ts.
 * noindex, fora do sitemap e do menu. ESTÁTICA: o mesmo HTML para todo visitante e para o revisor do anúncio (nada aqui lê
 * cabeçalhos, user-agent, referrer ou utm). Celular primeiro (375 px).
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import BottleCropImage from "@/components/campaign/BottleCropImage";
import CampaignBuyButton from "@/components/campaign/CampaignBuyButton";
import CampaignCartIcon from "@/components/campaign/CampaignCartIcon";
import CampaignMarker from "@/components/campaign/CampaignMarker";
import LineMiniCards, { LINE_PHOTOS } from "@/components/campaign/LineMiniCards";
import Gpt10Banner from "@/components/campaign/Gpt10Banner";
import { formatBRL, getProduct } from "@/lib/catalog/bio-products";
import { getProductMainImage } from "@/lib/catalog/product-images.server";
import { CAMPAIGN_SLUGS, getCampaignPage } from "@/lib/campaign/gpt-pages";

export const dynamicParams = false;

export function generateStaticParams() {
  return CAMPAIGN_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getCampaignPage(slug);

  if (!page) return {};

  return {
    title: `${page.title} | Bio Florais`,
    description: page.metaDescription,
    robots: { index: false, follow: false, nocache: true },
    alternates: { canonical: `/para/${page.slug}` },
  };
}

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getCampaignPage(slug);

  if (!page) notFound();

  const products = page.products.flatMap((entry) => {
    const product = getProduct(entry.slug);

    return product ? [{ entry, product, image: getProductMainImage(product) || null }] : [];
  });

  const hero = page.hero;

  return (
    <main className="min-h-screen bg-[#fffdf9] pb-12 text-[#2f2231]" data-testid="pagina-campanha">
      <CampaignMarker />

      <header className="border-b border-[#eadfd9] bg-white">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-5 py-3">
          <Link href="/" aria-label="Bio Florais" className="leading-none">
            <span className="block font-serif text-[26px] font-semibold tracking-[-0.03em] text-[#55245f]">Bio Florais</span>
            <span className="block text-[9px] font-extrabold uppercase tracking-[0.22em] text-[#a0742b]">Desde 1997</span>
          </Link>
          <CampaignCartIcon />
        </div>
      </header>

      <div className="mx-auto max-w-[720px] px-5">
        <section className="pt-6">
          <h1 className="font-serif text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#422347] sm:text-[40px]">{page.title}</h1>
          <p className="mt-3 text-[15px] leading-6 text-[#675866]">{page.lead}</p>
        </section>

        <div className="mt-4">
          <Gpt10Banner />
        </div>

        <div className="relative mt-4 max-h-[460px] w-full overflow-hidden rounded-[22px] bg-[#f6efe6]" style={{ aspectRatio: hero.aspect ?? "16 / 10" }}>
          <Image
            src={hero.src}
            alt={hero.alt}
            fill
            priority
            sizes="(max-width: 720px) 100vw, 720px"
            className="object-cover"
            style={{ objectPosition: hero.position ?? "50% 50%", transform: hero.scale ? `scale(${hero.scale})` : undefined, transformOrigin: hero.origin ?? "50% 50%" }}
          />
        </div>

        <section className="mt-6" aria-label="Produtos">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {products.map(({ entry, product, image }) => {
              const name = entry.label ?? product.name;

              return (
                <li
                  key={product.slug}
                  className="flex flex-col rounded-[20px] border border-[#eadfd9] bg-white p-3"
                  data-testid="campanha-produto"
                >
                  <div className="overflow-hidden rounded-[14px]">
                    {image && entry.crop ? (
                      <BottleCropImage src={image} alt={`Frasco do floral ${name}, Bio Florais`} crop={entry.crop} />
                    ) : image ? (
                      <div className="relative aspect-[4/5] w-full bg-white">
                        <Image src={image} alt={`Frasco do floral ${name}, Bio Florais`} fill sizes="(max-width: 640px) 50vw, 240px" className="scale-[1.3] object-contain" />
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#a0742b]">{page.lineLabel}</p>
                  <h2 className="mt-0.5 text-[15px] font-extrabold leading-tight text-[#422347]">{name}</h2>
                  <p className="mt-1 text-[11px] text-[#8a7886]">Floral em gotas · 31 ml</p>
                  <p className="mt-2 text-[17px] font-extrabold text-[#2f2231]">{formatBRL(product.priceCents)}</p>
                  <div className="mt-auto">
                    <CampaignBuyButton productSlug={product.slug} name={name} image={image} />
                  </div>
                </li>
              );
            })}

            {/* A grade tem sempre 4 cards: faltando produto, o 4º é o card da linha ("Conheça a linha"). */}
            {products.length < 4 ? (
              <li className="flex flex-col rounded-[20px] border border-[#eadfd9] bg-white p-3" data-testid="campanha-card-linha">
                <Link href={`/linha/${page.lineSlug}`} className="flex h-full flex-col">
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[14px] bg-[#f6efe6]">
                    {LINE_PHOTOS[page.lineSlug] ? (
                      <Image src={LINE_PHOTOS[page.lineSlug].src} alt="" fill sizes="(max-width: 640px) 50vw, 240px" className="object-cover" style={{ objectPosition: LINE_PHOTOS[page.lineSlug].position, transform: `scale(${LINE_PHOTOS[page.lineSlug].zoom ?? 1.25})`, transformOrigin: LINE_PHOTOS[page.lineSlug].position }} />
                    ) : null}
                  </div>
                  <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#a0742b]">{page.lineLabel}</p>
                  <h2 className="mt-0.5 text-[15px] font-extrabold leading-tight text-[#422347]">Conheça a linha</h2>
                  <p className="mt-1 text-[11px] text-[#8a7886]">Todas as versões em gotas</p>
                  <span className="mt-auto inline-flex w-full items-center justify-center rounded-full border-2 border-[#55245f] px-4 py-2.5 text-sm font-extrabold text-[#55245f]">Ver a linha</span>
                </Link>
              </li>
            ) : null}
          </ul>
        </section>

        <LineMiniCards />

        <section className="mt-8" aria-label="Perguntas frequentes" data-testid="campanha-faq">
          <h2 className="font-serif text-[22px] font-semibold text-[#422347]">Perguntas frequentes</h2>
          <div className="mt-3 divide-y divide-[#eadfd9] rounded-[18px] border border-[#eadfd9] bg-white">
            {page.faq.map((item) => (
              <details key={item.question} className="group p-4">
                <summary className="cursor-pointer list-none text-[15px] font-extrabold text-[#422347] marker:hidden">{item.question}</summary>
                <p className="mt-2 text-[14px] leading-6 text-[#675866]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-8 text-center">
          <Link href={`/linha/${page.lineSlug}`} className="inline-flex rounded-full border-2 border-[#55245f] px-6 py-3 text-sm font-extrabold text-[#55245f] transition hover:bg-[#f6eef7]" data-testid="campanha-ver-linha">
            Ver a linha completa
          </Link>
        </div>

      </div>
    </main>
  );
}
