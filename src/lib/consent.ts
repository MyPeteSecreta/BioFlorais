/**
 * Consentimento de cookies (LGPD) — escolha do visitante, guardada no navegador (localStorage).
 * Padrão = RECUSADO: enquanto não houver escolha, nada de marketing é carregado e o banner aparece.
 * Categorias: necessários (sempre), análise (nossa medição de visitas é sem cookies e sem dado pessoal, não
 * depende de escolha) e MARKETING (pixel de medição de anúncios — só com aceite).
 */

export const CONSENT_STORAGE_KEY = "bio_cookie_consent_v1";
export const CONSENT_EVENT = "bio-consent-change";
export const OPEN_SETTINGS_EVENT = "bio-open-cookie-settings";

export type ConsentChoice = { v: 1; marketing: boolean; at: string };

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** null = ainda sem escolha (mostra o banner). Qualquer valor inválido conta como sem escolha. */
export function readConsent(storage: StorageLike | null | undefined): ConsentChoice | null {
  try {
    const raw = storage?.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentChoice>;
    if (parsed?.v !== 1 || typeof parsed.marketing !== "boolean") return null;
    return { v: 1, marketing: parsed.marketing, at: String(parsed.at ?? "") };
  } catch {
    return null;
  }
}

export function writeConsent(storage: StorageLike | null | undefined, marketing: boolean, now: Date = new Date()): ConsentChoice {
  const choice: ConsentChoice = { v: 1, marketing, at: now.toISOString() };

  try {
    storage?.setItem(CONSENT_STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // sem armazenamento: a escolha vale só nesta página
  }

  return choice;
}

export const hasMarketingConsent = (storage: StorageLike | null | undefined) => readConsent(storage)?.marketing === true;
