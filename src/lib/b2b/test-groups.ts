/**
 * BIO FLORAIS B2B — dado de teste que vazou para produção
 * ("BIO-B2B TEST GROUP <hex>") nunca vira linha: nem no Offer Builder, nem no
 * link do cliente, nem no admin. Pura (usada também no navegador).
 */
export function isTestCommercialGroup(group: { slug: string; name: string }) {
  return /^\s*bio-b2b[\s-]*test/i.test(group.name) || /^bio-b2b-test/i.test(group.slug);
}
