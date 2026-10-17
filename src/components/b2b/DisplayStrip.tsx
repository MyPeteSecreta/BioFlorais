import Image from "next/image";
import Link from "next/link";

/**
 * Faixa do display compacto na vitrine B2B (link da oferta e loja pública), entre "Meus pedidos / Acompanhar pedido"
 * e o título "Sua oferta". Mesmo estilo dos cards de linha (borda, raio, sombra); foto à direita no desktop e EM CIMA
 * no celular. Sem foto do display, usa a imagem da linha.
 */
export default function DisplayStrip({ href, photo, fallbackImage }: { href: string; photo: string | null; fallbackImage: string | null }) {
  const image = photo ?? fallbackImage;

  return (
    <section
      data-testid="faixa-display"
      className="mb-8 overflow-hidden rounded-[26px] border border-[#eadfda] bg-white shadow-sm md:grid md:grid-cols-[1fr_minmax(0,360px)]"
    >
      {image && (
        <div className="relative aspect-[16/10] w-full bg-[#fffaf6] md:order-2 md:aspect-auto md:min-h-[260px]">
          <Image
            src={image}
            alt="Display compacto Bio Florais"
            fill
            sizes="(max-width: 768px) 100vw, 360px"
            className="object-contain"
            priority={false}
          />
        </div>
      )}

      <div className="flex flex-col justify-center gap-3 p-5 md:order-1 md:p-8">
        <span className="w-fit rounded-full bg-[#55245f] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-white">
          Display
        </span>
        <h2 className="font-serif text-2xl font-semibold text-[#55245f]">Pouco espaço no balcão? Temos uma opção compacta!</h2>
        <p className="text-sm text-[#746471]">
          O display Bio Florais ocupa só 15 × 15 cm.
          <br />8 fragrâncias, 12 unidades. Cabe ao lado do caixa e vende sozinho.
        </p>
        <Link
          href={href}
          prefetch={false}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#55245f] px-6 text-sm font-extrabold text-white md:w-fit"
        >
          Quero o kit com display
        </Link>
      </div>
    </section>
  );
}
