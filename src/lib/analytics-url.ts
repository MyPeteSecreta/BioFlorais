/*
 * Web Analytics (Vercel): sem cookies e sem dado pessoal. Os links do site carregam tokens na
 * URL (oferta B2B, convite/redefinição de senha, acompanhamento do pedido, ?b2b=<token> no
 * carrinho/checkout); eles NUNCA vão para o Analytics: o caminho é substituído por um
 * marcador antes do envio.
 */
const TOKEN_PATHS: Array<[RegExp, string]> = [
  [/^\/b2b\/oferta\/[^/?#]+/, "/b2b/oferta/[token]"],
  [/^\/b2b\/convite\/[^/?#]+/, "/b2b/convite/[token]"],
  [/^\/acompanhe\/[^/?#]+/, "/acompanhe/[token]"],
];

const SENSITIVE_PARAMS = ["b2b", "token", "email", "cpf", "cnpj"];

export function sanitizeAnalyticsUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, "https://placeholder.invalid");

    for (const [pattern, replacement] of TOKEN_PATHS) {
      url.pathname = url.pathname.replace(pattern, replacement);
    }

    for (const key of SENSITIVE_PARAMS) {
      url.searchParams.delete(key);
    }

    const base = /^https?:/i.test(rawUrl) ? url.origin : "";

    return `${base}${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}
