-- ============================================================================
-- BIO FLORAIS B2B — 33b: a mesma promoção em VÁRIAS linhas da mesma oferta (escolha por promoção + linha)
-- Projeto Neon: bio-florais. Idempotente, transação única. Rode o 33a antes.
-- Troca a chave única (offer_id, promotion_id) por (offer_id, promotion_id, commercial_group_id), para que
-- Adulto = B3 "2 compras", Pet = B1 "3 compras" e Infantil = B1 "60 dias" possam coexistir na oferta.
-- NÃO apaga nem altera nenhuma linha. Registros antigos (sem linha gravada) continuam valendo como antes.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  r record;
BEGIN
  -- Remove a PK/unique que cobre EXATAMENTE (offer_id, promotion_id), qualquer que seja o nome.
  FOR r IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'b2b_offer_promotions'::regclass
       AND c.contype IN ('p', 'u')
       AND (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
              FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k)
           = ARRAY['offer_id', 'promotion_id']
  LOOP
    EXECUTE format('ALTER TABLE b2b_offer_promotions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS b2b_offer_promotions_offer_promo_group_uq
  ON b2b_offer_promotions (offer_id, promotion_id, commercial_group_id);

COMMIT;
