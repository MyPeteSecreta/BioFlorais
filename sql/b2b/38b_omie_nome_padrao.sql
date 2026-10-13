-- ============================================================================
-- BIO FLORAIS B2B — 38b: "Nome no Omie" padrão = nome completo do cadastro do vendedor.
-- Projeto Neon: bio-florais. Idempotente, transação única. Rode o 38a antes.
-- SÓ PREENCHE ONDE ESTÁ VAZIO (nunca sobrescreve um nome já definido) e NUNCA em vendedor de
-- demonstração. Sem DELETE e sem trocar nenhuma outra coluna. Obs.: o app já aplica o padrão na leitura,
-- no cadastro do vendedor e no primeiro pedido; este SQL só adianta para quem a Central exporta primeiro.
-- ============================================================================
BEGIN;

UPDATE b2b_responsibles
   SET omie_vendor_code = left(regexp_replace(btrim(name), '\s+', ' ', 'g'), 70)
 WHERE (omie_vendor_code IS NULL OR btrim(omie_vendor_code) = '')
   AND btrim(coalesce(name, '')) <> ''
   AND COALESCE(to_jsonb(b2b_responsibles) ->> 'is_demo', 'false') <> 'true';

COMMIT;
