-- ============================================================================
-- BIO FLORAIS B2B — 34b: modelos de oferta do vendedor ("Minhas ofertas padrão", L2)
-- Projeto Neon: bio-florais. SOMENTE ADITIVO, idempotente, transação única. Rode o 34a antes.
-- Um modelo = nome + linhas + promoção/elegibilidade por (promoção, linha). Nada em tabelas existentes muda.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS b2b_offer_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responsible_id uuid NOT NULL REFERENCES b2b_responsibles (id),
  name text NOT NULL,
  commercial_group_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  promotions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  archived_at timestamp
);

CREATE INDEX IF NOT EXISTS b2b_offer_templates_responsible_idx ON b2b_offer_templates (responsible_id) WHERE archived_at IS NULL;

COMMIT;
