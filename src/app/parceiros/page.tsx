/**
 * BIO FLORAIS B2B — L3: página permanente de parceiros (flyer da equipe comercial): /parceiros.
 * Apresentação para o lojista, linhas com o preço B2B normal, "Quero comprar" (cadastro rápido que abre
 * o link padrão) e "Quero ser representante". ?v=<código> vincula o lojista àquele vendedor; sem ?v=,
 * ao vendedor da casa. Sem vendedor disponível: só a apresentação e "Falar com um representante".
 * noindex: o preço de lojista não deve aparecer no Google.
 */

import type { Metadata } from "next";
import Image from "next/image";

import PartnerSignupForm from "@/components/b2b/PartnerSignupForm";
import { homeLineImage } from "@/lib/b2b/line-images";
import { loadBuilderLines } from "@/lib/b2b/offer-builder";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { resolvePartnerSeller } from "@/lib/b2b/partners";
import { B2B_MIN_ORDER_CENTS, resolveB2BUnitPriceCents } from "@/lib/b2b/pricing";
import { bioProducts } from "@/lib/catalog/bio-products";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Parceiros | Bio Florais",
  description: "Condições B2B da Bio Florais para lojistas.",
  robots: { index: false, follow: false, nocache: true },
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const BENEFITS = [
  { title: `Pedido mínimo de ${money(B2B_MIN_ORDER_CENTS)}`, text: "Comece com um pedido enxuto e vá ampliando o mix." },
  { title: "Frete especial B2B", text: "Condições especiais de frete a partir de R$ 450 em produtos." },
  { title: "Pix, cartão em até 3x e boleto", text: "Boleto para CNPJ (PJ) e parcelamento em até 3x." },
  { title: "Entrega rápida", text: "Seu pedido separado e despachado com agilidade." },
];

function representativeUrl() {
  return process.env.B2B_DEMO_CTA_URL?.trim() || "https://wa.me/552139553713?text=Quero%20falar%20com%20um%20representante%20da%20Bio%20Florais";
}

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const run = getAppSqlRunner();
  const { seller, via } = await resolvePartnerSeller(run, v);
  // Sem as linhas (banco indisponível) a página segue só com a apresentação.
  const lines = await loadBuilderLines(new Date(), null).catch(() => []);

  const fromPrice = (slug: string) => {
    const prices = bioProducts
      .filter((product) => product.lineSlug === slug && product.priceCents !== null)
      .map((product) => resolveB2BUnitPriceCents(product.priceCents as number, product.category));

    return prices.length > 0 ? Math.min(...prices) : null;
  };

  return (
    <main className="bg-[#fffdf9] text-[#2f2231]">
      <section className="mx-auto max-w-[1100px] px-5 py-12 lg:px-10 lg:py-16">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9b6c24]">Bio Florais · Desde 1997</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-[#422347] sm:text-5xl">Bio Florais para o seu negócio</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[#665765]">
          Florais com flores frescas brasileiras e fórmulas sem álcool, com condições especiais para lojistas.
        </p>

        {via === "code" && seller && (
          <p className="mt-4 inline-block rounded-full bg-[#f3eaf5] px-4 py-2 text-sm font-bold text-[#55245f]">Seu representante: {seller.name}</p>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {seller ? (
            <a href="#cadastro" className="rounded-full bg-[#55245f] px-7 py-4 text-center text-base font-extrabold text-white shadow">
              Quero comprar
            </a>
          ) : (
            <a href={representativeUrl()} className="rounded-full bg-[#55245f] px-7 py-4 text-center text-base font-extrabold text-white shadow">
              Falar com um representante
            </a>
          )}
          <a
            href={representativeUrl()}
            className="rounded-full border-2 border-[#55245f] px-7 py-4 text-center text-base font-extrabold text-[#55245f]"
          >
            Quero ser representante
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 lg:px-10" aria-label="Vantagens">
        <ul className="grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="rounded-[22px] border border-[#eadfd9] bg-white p-5 shadow-sm">
              <p className="font-extrabold text-[#422347]">{benefit.title}</p>
              <p className="mt-1 text-sm text-[#746471]">{benefit.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {lines.length > 0 && (
        <section className="mx-auto max-w-[1100px] px-5 py-12 lg:px-10" aria-label="Linhas">
          <h2 className="font-serif text-3xl font-semibold text-[#422347]">Nossas linhas</h2>
          <p className="mt-2 text-sm text-[#746471]">Preço B2B normal, por unidade (sem promoções).</p>
          <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {lines.map((line) => {
              const image = homeLineImage(line.slug);
              const price = fromPrice(line.slug);

              return (
                <li key={line.id} className="overflow-hidden rounded-[22px] border border-[#eadfda] bg-white shadow-sm">
                  {image ? (
                    <div className="relative aspect-[16/9] w-full bg-[#fffaf6]">
                      <Image src={image} alt={line.name} fill sizes="(min-width: 1024px) 340px, 50vw" className="object-cover" />
                    </div>
                  ) : null}
                  <div className="p-4">
                    <p className="font-extrabold text-[#422347]">{line.name}</p>
                    {price !== null && <p className="mt-1 text-sm text-[#746471]">a partir de {money(price)}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {seller && (
        <section className="mx-auto max-w-[560px] px-5 pb-16 lg:px-10">
          <PartnerSignupForm referralCode={via === "code" ? (seller.referralCode ?? null) : null} />
        </section>
      )}
    </main>
  );
}
