/**
 * Links do orçamento (Rodada 19b). O botão principal de todo orçamento é "Continuar compra": restaura a sacola NA LOJA
 * (quantidades editáveis, dá para adicionar produtos) e segue para o checkout com dados e observações. Imprimir, WhatsApp e
 * Copiar link são secundários. Funções puras.
 */

/** Loja do link com o orçamento a restaurar. `launch` = modo "Lançar pedido" do representante. */
export function continueQuotePath(token: string, quoteId: string, launch = false): string {
  return `/b2b/oferta/${encodeURIComponent(token)}?orcamento=${encodeURIComponent(quoteId)}${launch ? "&lancar=1" : ""}`;
}

/** Folha de impressão pelo link (pessoal/geral) ou, sem token, pela sessão do representante. */
export function printQuotePath(quoteId: string, token?: string | null): string {
  return token ? `/b2b/oferta/${encodeURIComponent(token)}/pedidos/${encodeURIComponent(quoteId)}/imprimir` : `/b2b/pedido/${encodeURIComponent(quoteId)}/imprimir`;
}

/** wa.me com texto pronto; com telefone abre a conversa, sem telefone deixa escolher o contato. */
export function quoteWhatsAppUrl(continueUrl: string, phone?: string | null, who?: string | null): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const to = digits ? (digits.startsWith("55") ? digits : `55${digits}`) : "";
  const text = `${who ? `Olá, ${who}! ` : "Olá! "}Segue o seu orçamento Bio Florais. Para continuar a compra: ${continueUrl}`;

  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/** Token da oferta a partir da URL do link (…/b2b/oferta/<token>). */
export function tokenFromOfferUrl(url: string, base = "https://x.invalid"): string {
  try {
    return decodeURIComponent(new URL(url, base).pathname.split("/").filter(Boolean).pop() ?? "");
  } catch {
    return "";
  }
}
