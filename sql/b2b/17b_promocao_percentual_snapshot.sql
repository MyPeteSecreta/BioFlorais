-- ============================================================================
-- BIO FLORAIS B2B — 17b: snapshot da promoção de DESCONTO PERCENTUAL no item (C3)
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
-- order_items.promotion_type / promotion_percent / promotion_discount_cents.
-- unit_price_cents continua sendo o preço EFETIVO cobrado (Omie lê esse valor).
-- Não precisa de coluna nova em b2b_promotions (já existe `percentage`).
-- Pode rodar antes ou depois do deploy: sem as colunas o app grava o pedido
-- normalmente, só sem o snapshot do desconto.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS promotion_type text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS promotion_percent numeric;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS promotion_discount_cents integer;
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'order_items'
   AND column_name IN ('promotion_type', 'promotion_percent', 'promotion_discount_cents')
 ORDER BY column_name;
COMMIT;
