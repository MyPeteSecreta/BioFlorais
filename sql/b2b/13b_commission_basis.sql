-- ============================================================================
-- BIO FLORAIS B2B — 13b: base da comissão congelada no item (janela de 180 dias)
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
-- order_items.commission_basis: 'promotion' | 'normal_price' | 'base_only'.
-- Pedidos anteriores ficam NULL (foram calculados antes da janela).
-- Pode rodar antes ou depois do deploy: sem a coluna o app grava o pedido
-- normalmente, só sem a base.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_basis text;
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'order_items' AND column_name = 'commission_basis';
COMMIT;
