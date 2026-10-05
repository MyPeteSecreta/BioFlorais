-- ============================================================================
-- BIO FLORAIS B2B — 30b: "Vendedor no Omie" de cada vendedor
-- Projeto Neon: bio-florais. SOMENTE ADITIVO, idempotente, transação única.
-- Nome completo do vendedor exatamente como no cadastro de Vendedores do Omie
-- (coluna H do Pedido de Venda da Central Omie). Mesmo nome de coluna da My Pet.
-- Rode o 30a antes.
-- ============================================================================
BEGIN;

ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS omie_vendor_code text;

COMMIT;
