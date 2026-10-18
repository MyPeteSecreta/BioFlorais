/**
 * Redirecionamentos NÃO podem descartar a query string: oppref (identificador do clique no anúncio) e utm_* são
 * necessários para atribuir as vendas dos anúncios. Esta função anexa os parâmetros ao destino, exceto os internos.
 */
export function forwardQuery(
  path: string,
  params: Record<string, string | string[] | undefined> | undefined,
  internal: readonly string[] = []
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (internal.includes(key.toLowerCase())) continue;

    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== "") query.append(key, item);
    }
  }

  const text = query.toString();

  return text ? `${path}${path.includes("?") ? "&" : "?"}${text}` : path;
}
