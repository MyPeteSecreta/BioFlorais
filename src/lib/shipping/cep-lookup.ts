/**
 * Confere no SERVIDOR (ViaCEP) se a UF informada corresponde ao CEP.
 * Usado pelo B2B: a tarifa fixa de frete depende da UF, então a UF
 * declarada pelo navegador nunca é aceita sem conferência.
 */

export type CepVerificationResult =
  | { verified: true; matches: boolean; resolvedUf: string }
  | { verified: false };

export async function verifyCepMatchesState(
  cep: string,
  claimedState: string
): Promise<CepVerificationResult> {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });

    if (!response.ok) {
      return { verified: false };
    }

    const data = (await response.json()) as { uf?: string; erro?: boolean | string };

    if (data.erro || !data.uf) {
      return { verified: false };
    }

    const resolvedUf = data.uf.trim().toUpperCase();

    return {
      verified: true,
      matches: resolvedUf === claimedState.trim().toUpperCase(),
      resolvedUf,
    };
  } catch {
    return { verified: false };
  }
}
