-- ============================================================================
-- BIO FLORAIS B2B — ADMIN ABAS 2/3/4: SQL CANDIDATO (aditivo)
-- ============================================================================
-- Transação única. Só CREATE TABLE/INDEX IF NOT EXISTS. Sem DROP/UPDATE.
-- Tabela nova b2b_offer_line_views: "cliente visualizou a linha X fora da
-- oferta" (oferta, linha, cliente, vendedor, data). Necessária antes do
-- deploy: a página da oferta, o painel do vendedor e o admin a leem.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS b2b_offer_line_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES b2b_offers (id),
  commercial_group_id uuid NOT NULL REFERENCES b2b_commercial_groups (id),
  client_id uuid NOT NULL,
  responsible_id uuid NOT NULL,
  viewed_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS b2b_offer_line_views_offer_idx
  ON b2b_offer_line_views (offer_id, commercial_group_id);

CREATE INDEX IF NOT EXISTS b2b_offer_line_views_responsible_idx
  ON b2b_offer_line_views (responsible_id, viewed_at);

COMMIT;
