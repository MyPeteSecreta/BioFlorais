-- ============================================================================
-- BIO FLORAIS B2B — 14b: tipo da promoção e parâmetro de reconquista (Rodada 2)
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
--  * b2b_promotions.promo_type: 'abertura_reconquista' | 'recorrente'
--    (default 'abertura_reconquista': TODAS as promoções existentes, inclusive
--    as de teste, viram abertura/reconquista).
--  * b2b_settings (key/value) com reconquista_meses = 6.
-- Rodar ANTES do deploy desta rodada (o app lê promo_type).
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE b2b_promotions
  ADD COLUMN IF NOT EXISTS promo_type text NOT NULL DEFAULT 'abertura_reconquista';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'b2b_promotions_promo_type_check') THEN
    ALTER TABLE b2b_promotions
      ADD CONSTRAINT b2b_promotions_promo_type_check
      CHECK (promo_type IN ('abertura_reconquista', 'recorrente'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS b2b_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO b2b_settings (key, value) VALUES ('reconquista_meses', '6')
ON CONFLICT (key) DO NOTHING;

-- Conferência (esperado: todas as promoções abertura_reconquista; reconquista_meses = 6)
SELECT promo_type, count(*) AS promocoes FROM b2b_promotions GROUP BY promo_type;
SELECT key, value FROM b2b_settings;

COMMIT;
