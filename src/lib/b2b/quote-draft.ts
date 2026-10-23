/**
 * Rascunho do orçamento reaberto (Rodada 19b): "Continuar compra" restaura a sacola na loja e guarda, só nesta aba
 * (sessionStorage), o que o checkout precisa para continuar: orçamento de origem, dados do comprador, endereço e observações.
 * O checkout lê o rascunho ao abrir; salvar o orçamento, fechar o pedido ou descartar apaga.
 */

export type QuoteDraft = {
  quoteId: string | null;
  notice: string;
  customer: { personType: "pf" | "pj"; name: string; email: string; phone: string; cpf: string; cnpj: string; stateRegistration: string } | null;
  address: { cep: string; street: string; number: string; complement: string; district: string; city: string; state: string } | null;
  orderNote: string;
  couponCode: string | null;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const quoteDraftKey = (token: string) => `b2b-quote-draft:${token}`;

export function writeQuoteDraft(storage: StorageLike | null | undefined, token: string, draft: QuoteDraft): boolean {
  try {
    storage?.setItem(quoteDraftKey(token), JSON.stringify(draft));

    return Boolean(storage);
  } catch {
    return false;
  }
}

export function readQuoteDraft(storage: StorageLike | null | undefined, token: string): QuoteDraft | null {
  try {
    const raw = storage?.getItem(quoteDraftKey(token));
    if (!raw) return null;

    const data = JSON.parse(raw) as Partial<QuoteDraft>;
    if (!data || typeof data !== "object") return null;

    return {
      quoteId: typeof data.quoteId === "string" ? data.quoteId : null,
      notice: typeof data.notice === "string" ? data.notice : "",
      customer: data.customer ?? null,
      address: data.address ?? null,
      orderNote: typeof data.orderNote === "string" ? data.orderNote : "",
      couponCode: typeof data.couponCode === "string" ? data.couponCode : null,
    };
  } catch {
    return null;
  }
}

export function clearQuoteDraft(storage: StorageLike | null | undefined, token: string) {
  try {
    storage?.removeItem(quoteDraftKey(token));
  } catch {
    // sem armazenamento: nada a limpar
  }
}
