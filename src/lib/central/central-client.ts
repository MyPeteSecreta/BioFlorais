/**
 * A Bio chamando a Central (My Pet) — V4. CENTRAL_URL = endereço público da My Pet;
 * CENTRAL_API_SECRET = o mesmo segredo das 3 marcas (header x-central-secret).
 * Melhor esforço: sem variável, com a Central fora do ar ou lenta, nada disto atrapalha o vendedor.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";
import { lookupSellerProfile } from "@/lib/central/brand-api";
import { CENTRAL_SECRET_HEADER, type SellerProfileData, type SellerTermsAcceptance } from "@/lib/central/contract";

export const STORE_ID = "bio";
const TIMEOUT_MS = 4000;

export type ProfileSource = { store: string; label: string; profile: SellerProfileData; terms: SellerTermsAcceptance | null };

type FetchLike = typeof fetch;

function centralConfig(env: NodeJS.ProcessEnv = process.env) {
  const url = env.CENTRAL_URL?.trim().replace(/\/+$/, "");
  const secret = env.CENTRAL_API_SECRET;

  return url && secret ? { url, secret } : null;
}

async function centralFetch(path: string, init: RequestInit, fetcher: FetchLike, env?: NodeJS.ProcessEnv) {
  const config = centralConfig(env);

  if (!config) return null;

  const response = await fetcher(`${config.url}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), [CENTRAL_SECRET_HEADER]: config.secret, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  return response.ok ? ((await response.json().catch(() => null)) as Record<string, unknown> | null) : null;
}

/* "Usar meus dados de <marca>": cadastros COMPLETOS do mesmo e-mail nas OUTRAS marcas. */
export async function loadProfileSources(email: string, fetcher: FetchLike = fetch, env?: NodeJS.ProcessEnv): Promise<ProfileSource[]> {
  try {
    const data = await centralFetch(`/api/central/sellers/lookup?email=${encodeURIComponent(email)}&exclude=${STORE_ID}`, { method: "GET" }, fetcher, env);

    return data?.ok === true && Array.isArray(data.sources) ? (data.sources as ProfileSource[]) : [];
  } catch {
    return [];
  }
}

/* Depois que o vendedor completa o cadastro: a Central replica para as outras marcas. */
export async function replicateAfterCompletion(
  run: SqlRunner,
  responsibleId: string,
  fetcher: FetchLike = fetch,
  env?: NodeJS.ProcessEnv
): Promise<boolean> {
  try {
    const [row] = await run(`SELECT email FROM b2b_responsibles WHERE id = $1 LIMIT 1`, [responsibleId]);

    if (!row) return false;

    const email = String(row.email);
    const own = await lookupSellerProfile(run, email);

    if (!own.ok || !own.found || !own.complete) return false;

    const data = await centralFetch(
      "/api/central/sellers/replicate",
      { method: "POST", body: JSON.stringify({ fromStore: STORE_ID, email, profile: own.profile, terms: own.terms }) },
      fetcher,
      env
    );

    return data?.ok === true;
  } catch (error) {
    console.error("[central] replicação do cadastro falhou", error);

    return false;
  }
}
