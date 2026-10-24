/**
 * Fileira de mini cards com TODAS as linhas da Bio (foto + nome, levando à página da linha). Celular: carrossel horizontal
 * (375 px); a partir de md: grade. Mesmo conteúdo para todo visitante.
 */

import Image from "next/image";
import Link from "next/link";

import { bioLines } from "@/lib/catalog/bio-products";

/** Banner de cada linha (public/assets/home/linhas) e o recorte que mostra o frasco/cena sem as frases do banner. */
export const LINE_PHOTOS: Record<string, { src: string; position: string; zoom?: number }> = {
  adulto: { src: "/assets/home/linhas/Adulto.png", position: "96% 50%", zoom: 1.5 },
  pet: { src: "/assets/home/linhas/Pet.png", position: "78% 50%" },
  infantil: { src: "/assets/home/linhas/Infantil.png", position: "92% 50%" },
  baby: { src: "/assets/home/linhas/Baby.png", position: "92% 50%" },
  kids: { src: "/assets/home/linhas/Kids.png", position: "88% 50%" },
  teen: { src: "/assets/home/linhas/Teen.png", position: "92% 50%" },
  "dose-unica": { src: "/assets/home/linhas/DoseUnica.png", position: "8% 50%" },
  "virtudes-divinas": { src: "/assets/home/linhas/VirtudesDivinas.png", position: "92% 50%" },
  cosmeticos: { src: "/assets/home/linhas/Cosmetico.png", position: "8% 50%" },
  "cosmeticos-pet": { src: "/assets/home/linhas/CosmeticoPet.png", position: "78% 50%" },
  "home-care": { src: "/assets/home/linhas/HomeCare.png", position: "88% 50%" },
};

export default function LineMiniCards() {
  return (
    <section className="mt-10" aria-label="Todas as linhas Bio Florais" data-testid="campanha-linhas">
      <h2 className="font-serif text-[22px] font-semibold text-[#422347]">Conheça todas as linhas</h2>

      <ul className="-mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {bioLines.map((line) => {
          const photo = LINE_PHOTOS[line.slug];

          return (
            <li key={line.slug} className="w-[132px] shrink-0 snap-start md:w-auto">
              <Link href={`/linha/${line.slug}`} className="block overflow-hidden rounded-[18px] border border-[#eadfd9] bg-white transition hover:shadow-md" data-testid="campanha-linha-card">
                <span className="relative block aspect-[4/5] bg-[#f6efe6]">
                  {photo ? (
                    <Image src={photo.src} alt="" fill sizes="(max-width: 768px) 132px, 170px" className="object-cover" style={{ objectPosition: photo.position, transform: `scale(${photo.zoom ?? 1.25})`, transformOrigin: photo.position }} />
                  ) : null}
                </span>
                <span className="block px-3 py-2.5 text-center text-[13px] font-extrabold leading-4 text-[#422347]">{line.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
