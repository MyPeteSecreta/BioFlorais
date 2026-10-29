-- ============================================================================
-- BIO FLORAIS B2B — 52b: LINKS COM PROMOÇÃO do vendedor (link geral /parceiros?v=<código>&promo=<código curto>).
-- Projeto Neon: bio-florais. SOMENTE ADITIVO, idempotente, transação única, sem DELETE de dados.
--  * b2b_promo_links: um link por linha (vários por vendedor), com nome, validade, a promoção ATIVA do admin escolhida
--    (ou um kit display) e a elegibilidade (compras ou dias) que o cliente novo recebe.
--  * b2b_offers.promo_link_id: a vitrine DAQUELE link (oferta pública com a promoção, marcada is_storefront).
--  * o índice único "uma vitrine por vendedor" passa a valer só para a vitrine padrão (sem link com promoção).
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS b2b_promo_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responsible_id uuid NOT NULL REFERENCES b2b_responsibles(id),
  code text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('promotion', 'display')),
  promotion_id uuid REFERENCES b2b_promotions(id),
  display_key text,
  eligibility_mode text,
  max_uses integer,
  duration_days integer,
  expires_at timestamp,
  offer_id uuid REFERENCES b2b_offers(id),
  created_at timestamp NOT NULL DEFAULT now(),
  revoked_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS b2b_promo_links_code_uq ON b2b_promo_links (upper(code));
CREATE INDEX IF NOT EXISTS b2b_promo_links_responsible_idx ON b2b_promo_links (responsible_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_offers' AND column_name = 'promo_link_id') THEN
    ALTER TABLE b2b_offers ADD COLUMN promo_link_id uuid;
  END IF;
END $$;

DROP INDEX IF EXISTS b2b_offers_storefront_uq;
CREATE UNIQUE INDEX IF NOT EXISTS b2b_offers_storefront_uq ON b2b_offers (responsible_id) WHERE is_storefront = true AND promo_link_id IS NULL;

-- Conferência
SELECT (SELECT count(*) FROM b2b_promo_links) AS links_com_promocao,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_offers' AND column_name = 'promo_link_id') AS coluna_promo_link_id;

COMMIT;
