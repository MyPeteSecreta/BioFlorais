-- ============================================================================
-- BIO FLORAIS B2B — OFFER BUILDER: SQL CANDIDATO (aditivo, transação única)
-- ============================================================================
-- Só ADD COLUMN IF NOT EXISTS e CHECK NOT VALID condicionado. Sem DROP,
-- sem ALTER TYPE, sem UPDATE.
--
-- Necessário ANTES do deploy desta etapa:
--  * b2b_offer_promotions: linha e elegibilidade escolhidas no Offer Builder;
--  * order_items: snapshot de promoção e comissão congelada no pedido.
--    Pela introspecção de 29/09 essas colunas JÁ existem na Bio; o
--    IF NOT EXISTS só garante. ATENÇÃO: o schema.ts passa a declará-las,
--    e telas B2C/admin que leem order_items com select() dependem delas.
-- Requer 06b aplicado antes (b2b_commission_rules).
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE b2b_offer_promotions ADD COLUMN IF NOT EXISTS commercial_group_id uuid;
ALTER TABLE b2b_offer_promotions ADD COLUMN IF NOT EXISTS eligibility_mode text;
ALTER TABLE b2b_offer_promotions ADD COLUMN IF NOT EXISTS duration_days integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'b2b_offer_promotions_eligibility_mode_check') THEN
    ALTER TABLE b2b_offer_promotions
      ADD CONSTRAINT b2b_offer_promotions_eligibility_mode_check
      CHECK (eligibility_mode IS NULL OR eligibility_mode IN ('uses', 'days'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'b2b_offer_promotions_group_fk') THEN
    ALTER TABLE b2b_offer_promotions
      ADD CONSTRAINT b2b_offer_promotions_group_fk
      FOREIGN KEY (commercial_group_id) REFERENCES b2b_commercial_groups (id)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS paid_qty integer;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS bonus_qty integer;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS physical_qty integer;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS promotion_id text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS promotion_name text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS promotion_buy_quantity integer;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS promotion_free_quantity integer;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_base_percent numeric;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_extra_percent numeric;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_total_percent numeric;

COMMIT;
