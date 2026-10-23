/**
 * GPT10 automático (Rodada 20): quem passa por /para/* ganha o cupom GPT10 aplicado na sacola, e pode removê-lo no checkout.
 * O estado fica só no navegador (localStorage, sem dado pessoal). O cupom em si é validado pelo servidor (SQL 50b: 10%, só B2C,
 * 1 uso por e-mail, até 30/11/2026 23:59:59 BRT, sem acumular com outro cupom comercial).
 * Funções puras com armazenamento injetado (testável sem navegador).
 */

import { CAMPAIGN_GPT10 } from "@/lib/campaign/gpt-pages";

export const GPT10_STORAGE_KEY = "bio_campaign_coupon_v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type Gpt10State = { code: string; removed: boolean; at: string };

export const isGpt10Open = (now: Date = new Date()) => now.getTime() <= Date.parse(CAMPAIGN_GPT10.endsAt);

/** Marca a passagem por /para/*: o cupom volta a ser aplicado (mesmo que antes tenha sido removido). */
export function markGpt10(storage: StorageLike | null | undefined, now: Date = new Date()): boolean {
  try {
    if (!storage || !isGpt10Open(now)) return false;

    storage.setItem(GPT10_STORAGE_KEY, JSON.stringify({ code: CAMPAIGN_GPT10.code, removed: false, at: now.toISOString() } satisfies Gpt10State));

    return true;
  } catch {
    return false;
  }
}

export function readGpt10(storage: StorageLike | null | undefined): Gpt10State | null {
  try {
    const raw = storage?.getItem(GPT10_STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as Partial<Gpt10State>;

    return data && data.code === CAMPAIGN_GPT10.code ? { code: data.code, removed: data.removed === true, at: String(data.at ?? "") } : null;
  } catch {
    return null;
  }
}

/** O cliente removeu o cupom no checkout: não aplica de novo (até uma nova passagem por /para/*). */
export function removeGpt10(storage: StorageLike | null | undefined): void {
  try {
    const current = readGpt10(storage);
    if (storage && current) storage.setItem(GPT10_STORAGE_KEY, JSON.stringify({ ...current, removed: true }));
  } catch {
    // sem armazenamento: nada a registrar
  }
}

export function clearGpt10(storage: StorageLike | null | undefined): void {
  try {
    storage?.removeItem(GPT10_STORAGE_KEY);
  } catch {
    // sem armazenamento
  }
}

/** Aplica sozinho quando: passou por /para/*, não removeu, há sacola, ainda não há cupom comercial e a campanha está no prazo. */
export function shouldAutoApplyGpt10(input: { state: Gpt10State | null; hasCommercialCoupon: boolean; cartHasItems: boolean; now?: Date }): boolean {
  return Boolean(input.state && !input.state.removed && !input.hasCommercialCoupon && input.cartHasItems && isGpt10Open(input.now));
}
