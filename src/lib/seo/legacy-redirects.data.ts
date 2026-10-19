/**
 * DADOS do mapa de redirects 301 do site antigo (URL-01). Arquivo separado do código para completar depois com o
 * Search Console e a auditoria (URL-02): é só adicionar linhas aqui. A lógica fica em legacy-redirects.ts.
 *
 * Tudo aqui vira 301 (permanente) PRESERVANDO a query string inteira (utm_*, oppref): quem aplica é o middleware.
 */

/** Origem exata (sem barra final) -> destino. Casos conhecidos, mapeados um a um. */
export const LEGACY_EXACT_ENTRIES: ReadonlyArray<readonly [string, string]> = [

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
];

/**
 * Aliases explícitos `/fa-<...>` (FA = floral adulto) -> sufixo do slug atual `adulto-floral-em-gotas-<sufixo>`.
 * Além destes, o resolver casa automaticamente pelo NOME do produto (ver legacy-redirects.ts). Complete aqui o que sobrar.
 */
export const LEGACY_FA_ALIASES: Readonly<Record<string, string>> = {
  "fa-sensacao-de-tensao-e-stress": "stress",
  "fa-tensao-e-stress": "stress",
  "fa-sensacao-de-tristeza-e-estado-depressivo": "tristeza-estado-depressivo",
  "fa-tristeza-e-estado-depressivo": "tristeza-estado-depressivo",
  "fa-s-o-s": "rescue",
  "fa-sos": "rescue",
  "fa-resgate-rescue": "rescue",
  "fa-reducao-de-peso": "reducao-de-peso",
  "fa-momento-reequilibrio-alimentar-visando-reducao-de-peso": "reducao-de-peso",
  "fa-momento-de-mudancas-de-vida": "mudancas-na-vida",
  "fa-mudancas-de-vida": "mudancas-na-vida",
  "fa-quebra-das-correntes-de-vicios-e-dependencias": "vicios-e-dependencias",
  "fa-momento-de-quebra-das-correntes-de-vicios-e-dependencias": "vicios-e-dependencias",
};

/** Prefixo curto do site antigo -> linha atual (fk = kids, fb = baby, ft = teen, fv = virtudes divinas). */
export const LEGACY_LINE_PREFIXES: Readonly<Record<string, string>> = {
  fa: "adulto",
  fk: "kids",
  fb: "baby",
  ft: "teen",
  fv: "virtudes-divinas",
};

/**
 * Palavras-chave de /categoria-produto/*, /produto-tag/*, /produto-etiqueta/* -> linha. A PRIMEIRA que aparecer no caminho
 * vence (ordem importa: pet antes de cosmético, etc.). Sem palavra-chave = home. "promocao" não tem página equivalente = home.
 */
export const LEGACY_CATEGORY_KEYWORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/promo/, "/"],
  [/cosmetic[a-z-]*pet|pet[a-z-]*(shampoo|condicionador|perfume|spray|banho|cosmetic)|(shampoo|condicionador|perfume|banho)[a-z-]*pet/, "/linha/cosmeticos-pet"],
  [/shampoo|condicionador|sabonete|creme|cosmetic|hidratante/, "/linha/cosmeticos"],
  [/home-care|aromatizador|odorizador|ambiente|its-blossom/, "/linha/home-care"],
  [/dose-unica|dose-unic/, "/linha/dose-unica"],
  [/virtude/, "/linha/virtudes-divinas"],
  [/\bpet\b|(^|-)pet(-|$)|veterinario|cao|caes|gato|animal/, "/linha/pet"],
  [/baby|bebe/, "/linha/baby"],
  [/kids|crianca/, "/linha/kids"],
  [/teen|adolescente/, "/linha/teen"],
  [/infantil/, "/linha/infantil"],
  [/adulto|tradicional/, "/linha/adulto"],
];
