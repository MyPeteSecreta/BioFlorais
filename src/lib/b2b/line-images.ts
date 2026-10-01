/**
 * BIO FLORAIS B2B — mapa visual: slug do grupo comercial -> arte REAL do
 * card da linha na Home B2C (src/app/page.tsx, public/assets/home/linhas).
 * Só associa o asset já publicado; não redesenha nada (Runbook V1.29 §48).
 * Grupo sem arte cai num card com o nome.
 */
export const HOME_LINE_IMAGES: Record<string, string> = {
  adulto: "/assets/home/linhas/Adulto.png",
  pet: "/assets/home/linhas/Pet.png",
  infantil: "/assets/home/linhas/Infantil.png",
  baby: "/assets/home/linhas/Baby.png",
  kids: "/assets/home/linhas/Kids.png",
  teen: "/assets/home/linhas/Teen.png",
  "dose-unica": "/assets/home/linhas/DoseUnica.png",
  "virtudes-divinas": "/assets/home/linhas/VirtudesDivinas.png",
  cosmeticos: "/assets/home/linhas/Cosmetico.png",
  "cosmeticos-pet": "/assets/home/linhas/CosmeticoPet.png",
  "home-care": "/assets/home/linhas/HomeCare.png",
};

export function homeLineImage(slug: string) {
  return HOME_LINE_IMAGES[slug] ?? null;
}
