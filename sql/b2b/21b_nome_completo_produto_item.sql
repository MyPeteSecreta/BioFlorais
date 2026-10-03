-- ============================================================================
-- BIO FLORAIS B2B — 21b: nome COMPLETO do produto no item do pedido
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
-- order_items.product_name_snapshot (a central de pedidos / exportação Omie já leem
-- este campo, com fallback para products.name). Só pedidos B2B NOVOS o preenchem
-- ("Shampoo Agressividade · Cosméticos Pet · 500 ml"); os antigos e o B2C ficam NULL
-- e continuam com o nome de sempre. Se a coluna já existir, o comando não faz nada.
-- Pode rodar antes ou depois do deploy (sem a coluna o app grava o pedido sem o nome).
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name_snapshot text;
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'order_items' AND column_name = 'product_name_snapshot';
COMMIT;
