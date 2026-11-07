/**
 * LINKS CURTOS para posts (Facebook orgânico e outros): bioflorais.com.br/v/<codigo> → destino com a UTM (302).
 * Aprovado pelo Luis em 06/11. Para acrescentar um link, inclua UMA linha em LINKS_CURTOS (código em minúsculas, sem acento,
 * só letras, números e hífen; destino sempre um caminho do próprio site, começando com "/").
 *
 *  - Código que não existe → home com utm_campaign=link_desconhecido.
 *  - Nunca redireciona para fora do site: o destino é um caminho (o domínio é sempre o do próprio pedido).
 *  - A atribuição é a de um link normal: a página de destino lê a UTM da URL e grava o cookie bio_origem (first-touch),
 *    que vai para o pedido. Outros parâmetros que chegam no link curto (ex.: fbclid) seguem junto; utm_* da tabela vencem.
 */

export type LinkCurto = {
  destino: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  /** Opcional (ex.: "story"). */
  utm_content?: string;
};

/** Post orgânico do Facebook: utm_source=facebook, utm_medium=organic, utm_campaign=org_<codigo>. */
const facebookOrganico = (codigo: string, destino: string): [string, LinkCurto] => [
  codigo,
  { destino, utm_source: "facebook", utm_medium: "organic", utm_campaign: `org_${codigo}` },
];

/**
 * Figurinha de link no Story do Instagram (o Instagram recusa link longo, 07/11): código ig-<codigo>,
 * utm_source=instagram, utm_medium=organic, utm_campaign=org_ig_<codigo>, utm_content=story.
 */
const instagramStory = (codigo: string, destino: string): [string, LinkCurto] => [
  `ig-${codigo}`,
  { destino, utm_source: "instagram", utm_medium: "organic", utm_campaign: `org_ig_${codigo}`, utm_content: "story" },
];

export const LINKS_CURTOS: Readonly<Record<string, LinkCurto>> = Object.fromEntries([
  facebookOrganico("fogos", "/produto/pet-floral-em-gotas-medo-de-fogos"),
  facebookOrganico("sono", "/produto/adulto-floral-em-gotas-sono"),
  facebookOrganico("ansiedade", "/produto/adulto-floral-em-gotas-sensacao-de-ansiedade"),
  facebookOrganico("baby", "/produto/baby-floral-em-gotas-sono"),
  facebookOrganico("pet", "/linha/pet"),
  facebookOrganico("adulto", "/linha/adulto"),
  facebookOrganico("infantil", "/linha/infantil"),
  facebookOrganico("esquenta", "/"),

  instagramStory("fogos", "/produto/pet-floral-em-gotas-medo-de-fogos"),
  instagramStory("sono", "/produto/adulto-floral-em-gotas-sono"),
  instagramStory("ansiedade", "/produto/adulto-floral-em-gotas-sensacao-de-ansiedade"),
  instagramStory("baby", "/produto/baby-floral-em-gotas-sono"),
  instagramStory("pet", "/linha/pet"),
  instagramStory("adulto", "/linha/adulto"),
  instagramStory("infantil", "/linha/infantil"),
  instagramStory("esquenta", "/"),
]);

/** Destino quando o código não existe (ou a linha da tabela está errada). */
export const LINK_DESCONHECIDO = { destino: "/", utm_campaign: "link_desconhecido" } as const;

/** Código válido: minúsculas, números e hífen (até 40). */
export const CODIGO_VALIDO = /^[a-z0-9-]{1,40}$/;

/** Caminho do próprio site: começa com "/", nunca "//" nem barra invertida, sem esquema nem espaço. */
export function isCaminhoInterno(destino: string): boolean {
  return /^\/(?![/\\])[^\s\\]*$/.test(destino) && !/^\/[^?#]*:/.test(destino);
}

/**
 * Caminho + query do redirecionamento (sempre relativo ao próprio site). `searchRecebido` = query que veio no /v/<codigo>.
 */
export function resolveLinkCurto(codigoBruto: string | null | undefined, searchRecebido = ""): string {
  const codigo = String(codigoBruto ?? "").trim().toLowerCase();
  const link = CODIGO_VALIDO.test(codigo) ? LINKS_CURTOS[codigo] : undefined;
  const valido = link && isCaminhoInterno(link.destino);

  const destino = valido ? link.destino : LINK_DESCONHECIDO.destino;
  const [caminho, queryDestino = ""] = destino.split("?");
  const params = new URLSearchParams(queryDestino);

  // Parâmetros que vieram no link curto (ex.: fbclid), menos utm_*: a UTM é sempre a da tabela.
  for (const [key, value] of new URLSearchParams(searchRecebido)) {
    if (!key.toLowerCase().startsWith("utm_") && !params.has(key)) params.append(key, value);
  }

  if (valido) {
    params.set("utm_source", link.utm_source);
    params.set("utm_medium", link.utm_medium);
    params.set("utm_campaign", link.utm_campaign);
    if (link.utm_content) params.set("utm_content", link.utm_content);
  } else {
    params.set("utm_campaign", LINK_DESCONHECIDO.utm_campaign);
  }

  const query = params.toString();

  return query ? `${caminho}?${query}` : caminho;
}
