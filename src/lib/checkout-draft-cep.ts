/** CEP calculado na sacola → rascunho do checkout (sessionStorage "bio-checkout-draft"), que já abre com ele preenchido (14/11). */

const DRAFT_KEY = "bio-checkout-draft";

export const onlyCepDigits = (value: string) => value.replace(/\D/g, "").slice(0, 8);
export const formatCep = (digits: string) => (digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits);

/** Grava o CEP no rascunho do checkout sem apagar o que já está lá. */
export function saveCepToCheckoutDraft(storage: Pick<Storage, "getItem" | "setItem">, digits: string) {
  let draft: { fields?: Record<string, string> } = {};

  try {
    draft = JSON.parse(storage.getItem(DRAFT_KEY) ?? "{}") ?? {};
  } catch {
    draft = {};
  }

  storage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, fields: { ...(draft.fields ?? {}), postalCode: formatCep(digits) } }));
}

export function readCepFromCheckoutDraft(storage: Pick<Storage, "getItem">): string {
  try {
    const draft = JSON.parse(storage.getItem(DRAFT_KEY) ?? "{}") as { fields?: Record<string, string> };

    return onlyCepDigits(String(draft?.fields?.postalCode ?? ""));
  } catch {
    return "";
  }
}
