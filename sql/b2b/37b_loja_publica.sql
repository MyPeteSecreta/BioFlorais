-- ============================================================================
-- BIO FLORAIS B2B — 37b: LOJA B2B PÚBLICA (/parceiros). Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única. Rode o 37a antes (e o 35b já deve estar aplicado).
--  * b2b_offers.is_storefront: a "vitrine" de um vendedor (oferta padrão sem promoção, pública, que o
--    /parceiros abre). No máximo UMA por vendedor. Nunca aparece como oferta/cliente do vendedor.
--  * orders.origin / orders.origin_code: de onde veio o pedido ('parceiros') e o código ?v= (relatório).
-- Cada coluna é conferida antes (sem travar a tabela quando já existe); lock_timeout falha rápido.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_offers' AND column_name = 'is_storefront') THEN
    ALTER TABLE b2b_offers ADD COLUMN is_storefront boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'origin') THEN
    ALTER TABLE orders ADD COLUMN origin text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'origin_code') THEN
    ALTER TABLE orders ADD COLUMN origin_code text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS b2b_offers_storefront_uq ON b2b_offers (responsible_id) WHERE is_storefront = true;
CREATE INDEX IF NOT EXISTS orders_origin_idx ON orders (origin) WHERE origin IS NOT NULL;

COMMIT;
