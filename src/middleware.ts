import { NextRequest, NextResponse } from "next/server";

const LEGACY_REDIRECTS = new Map<string, string>([
  ["/produto/sensacao-de-ansiedade-2", "/produto/adulto-floral-em-gotas-sensacao-de-ansiedade"],
  ["/produto/sensacao-de-ansiedade-floral-adulto-31ml", "/produto/adulto-floral-em-gotas-sensacao-de-ansiedade"],
  ["/produto/sono", "/produto/adulto-floral-em-gotas-sono"],
  ["/produto/sono-floral-adulto-31ml", "/produto/adulto-floral-em-gotas-sono"],
  ["/produto/sono-linha-tradicional-31ml", "/produto/adulto-floral-em-gotas-sono"],
  ["/produto/sensacao-de-tensao-e-stress-floral-adulto-31ml", "/produto/adulto-floral-em-gotas-stress"],
  ["/produto/tensao-e-stress-linha-tradicional-31ml", "/produto/adulto-floral-em-gotas-stress"],
  ["/floral-tensao-e-stress-linha-tradicional", "/produto/adulto-floral-em-gotas-stress"],
  ["/produto/sensacao-de-tristeza-e-estado-depressivo-linha-tradicional-31ml", "/produto/adulto-floral-em-gotas-tristeza-estado-depressivo"],
  ["/floral-sensacao-de-tristeza-e-estado-depressivo-linha-tradicional", "/produto/adulto-floral-em-gotas-tristeza-estado-depressivo"],
  ["/produto/fase-da-menopausa-linha-tradicional-31ml", "/produto/adulto-floral-em-gotas-fase-da-menopausa"],
  ["/produto/sucesso-financeiro-linha-tradicional-31ml", "/produto/adulto-floral-em-gotas-sucesso-financeiro"],
  ["/produto/rescue-linha-tradicional-31ml", "/produto/adulto-floral-em-gotas-rescue"],
  ["/floral-s-o-s-linha-tradicional", "/produto/adulto-floral-em-gotas-rescue"],
  ["/produto/resgate-rescue-retten-sauvetage-salvataggio-s-o-s", "/produto/adulto-floral-em-gotas-rescue"],
  ["/floral-sensacao-de-medo-linha-tradicional", "/produto/adulto-floral-em-gotas-medo"],
  ["/produto/floral-momento-reequilibrio-alimentar-visando-reducao-de-peso-linha-tradicional", "/produto/adulto-floral-em-gotas-reducao-de-peso"],
  ["/floral-momento-de-mudancas-de-vida-linha-tradicional", "/produto/adulto-floral-em-gotas-mudancas-na-vida"],
  ["/floral-sensacao-de-panico-social-linha-tradicional", "/produto/adulto-floral-em-gotas-panico-social"],
  ["/floral-sensacao-de-panico-linha-tradicional", "/produto/adulto-floral-em-gotas-panico"],
  ["/produto/parar-de-fumar-linha-tradicional-31ml", "/produto/adulto-floral-em-gotas-parar-de-fumar"],
  ["/produto/floral-sensacao-de-carencia-de-alegria-linha-tradicional", "/produto/adulto-floral-em-gotas-carencia-de-alegria"],
  ["/produto/momento-do-estudante", "/produto/adulto-floral-em-gotas-momento-do-estudante"],
  ["/produto/momento-de-quebra-das-correntes-de-vicios-e-dependencias", "/produto/adulto-floral-em-gotas-vicios-e-dependencias"],
  ["/fa-lideranca", "/produto/adulto-floral-em-gotas-lideranca"],
  ["/produto/sensacao-de-ansiedade", "/produto/kids-floral-em-gotas-ansiedade"],
  ["/fk-sensacao-de-ansiedade", "/produto/kids-floral-em-gotas-ansiedade"],
  ["/produto/ansiedade-floral-infantil-31ml", "/produto/infantil-floral-em-gotas-ansiedade"],
  ["/produto/sono-floral-infantil-31ml", "/produto/infantil-floral-em-gotas-sono"],
  ["/floral-infantil-sono", "/produto/infantil-floral-em-gotas-sono"],
  ["/produto/floral-infantil-rescue-resgate-salvetage-salvataggio-s-o-s", "/produto/infantil-floral-em-gotas-rescue-s-o-s"],
  ["/produto/choro-excessivo", "/produto/baby-floral-em-gotas-choro-excessivo"],
  ["/fb-choro-excessivo", "/produto/baby-floral-em-gotas-choro-excessivo"],
  ["/produto/sono-floral-baby-31ml", "/produto/baby-floral-em-gotas-sono"],
  ["/produto/rescue-floral-baby-31ml", "/produto/baby-floral-em-gotas-rescue-s-o-s"],
  ["/produto/ansiedade-floral-pet-31ml", "/produto/pet-floral-em-gotas-ansiedade"],
  ["/produto/rescue-floral-pet-31ml", "/produto/pet-floral-em-gotas-s-o-s"],
  ["/produto/agressividade-floral-pet-31ml", "/produto/pet-floral-em-gotas-agressividade"],
  ["/medo-37ml", "/produto/pet-floral-em-gotas-medo"],
  ["/latido-excessivo-37ml", "/produto/pet-floral-em-gotas-latido-excessivo"],
  ["/ft-relacionamentos", "/produto/teen-floral-em-gotas-relacionamentos"],
  ["/produto/dose-unica-sono", "/produto/dose-unica-floral-dose-unica-sono"],
  ["/produto/dose-unica-ansiedade", "/produto/dose-unica-floral-dose-unica-ansiedade"],
  ["/dose-unica-ansiedade", "/produto/dose-unica-floral-dose-unica-ansiedade"],
  ["/dose-unica-stress", "/produto/dose-unica-floral-dose-unica-stress"],
  ["/produto/rescue-dose-unica-7ml", "/produto/dose-unica-floral-dose-unica-rescue-s-o-s"],
  ["/fv-tolerancia", "/produto/virtudes-divinas-virtudes-divinas-tolerancia"],
  ["/fv-prudencia", "/produto/virtudes-divinas-virtudes-divinas-prudencia"],
  ["/produto/simplicidade-floral-virtudes-15ml", "/produto/virtudes-divinas-virtudes-divinas-simplicidade"],
  ["/produto/benevolencia-floral-virtudes-15ml", "/produto/virtudes-divinas-virtudes-divinas-benevolencia"],
  ["/produto/justica-floral-virtudes-15ml", "/produto/virtudes-divinas-virtudes-divinas-justica"],
  ["/produto/docura-floral-virtudes-15ml", "/produto/virtudes-divinas-virtudes-divinas-docura"],
  ["/produto/leveza-floral-virtudes-15ml", "/produto/virtudes-divinas-virtudes-divinas-leveza"],
  ["/produto/generosidade-floral-virtudes-15ml", "/produto/virtudes-divinas-virtudes-divinas-generosidade"],
  ["/produto/serenidade-floral-virtudes-15ml", "/produto/virtudes-divinas-virtudes-divinas-serenidade"],
  ["/produto/autoconfianca-floral-virtudes-15ml", "/produto/virtudes-divinas-virtudes-divinas-autoconfianca"],
  ["/produto/shampoo-cabelos-secos-bio-florais-300ml", "/produto/cosmeticos-shampoo-cabelos-secos"],
  ["/condicionador-reparador-the-cat-colty", "/produto/cosmeticos-condicionador-condicionador-premium"],
  ["/perfume-filhotes-500ml", "/produto/cosmeticos-pet-perfume-spray-filhotes"],
  ["/produto/perfume-ansiedade-bio-pet-500ml", "/produto/cosmeticos-pet-perfume-spray-ansiedade"],
  ["/produto/spray-para-halito-menta-bio-pet-120ml", "/produto/cosmeticos-pet-higiene-oral-spray-para-halito-menta"],
  ["/produto/floral-de-ambiente-limpeza-e-protecao-its-blossom-240ml", "/produto/home-care-aromatizador-spray-limpeza-e-protecao"],
  ["/floral-de-ambiente-bem-estar-240ml", "/produto/home-care-aromatizador-spray-bem-estar"],
  ["/categoria-produto/bio-florais", "/"],
  ["/categoria-produto/bio-florais/floral-linha-tradicional", "/linha/adulto"],
  ["/categoria-produto/floral", "/#linhas"],
  ["/categoria-produto/floral/linha-infantil", "/linha/infantil"],
  ["/infantil", "/linha/infantil"],
  ["/kids", "/linha/kids"],
  ["/categoria-produto/floral/linha-pet-floral", "/linha/pet"],
  ["/categoria-produto/bio-pet/bio-pet-floral-veterinario", "/linha/pet"],
  ["/categoria-produto/bio-pet/bio-pet-floral-veterinario/bio-pet-floral-veterinario-floral-para-caes-e-gatos", "/linha/pet"],
  ["/produto-tag/adulto", "/linha/adulto"],
  ["/a-historia-dos-florais", "/terapia-floral"],
  ["/categoria/9068226.html", "/linha/cosmeticos-pet"],
]);

function normalizeLegacyPath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function middleware(request: NextRequest) {
  const source = normalizeLegacyPath(request.nextUrl.pathname);
  const destination = LEGACY_REDIRECTS.get(source);

  if (!destination) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  const hashPosition = destination.indexOf("#");

  if (hashPosition >= 0) {
    url.pathname = destination.slice(0, hashPosition);
    url.hash = destination.slice(hashPosition);
  } else {
    url.pathname = destination;
    url.hash = "";
  }

  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};