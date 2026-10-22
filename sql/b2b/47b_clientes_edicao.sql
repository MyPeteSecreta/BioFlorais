-- ============================================================================
-- BIO FLORAIS — 47b: edição do cadastro de clientes no admin, com histórico (Rodada 19b). Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única, linha final "ok". Rode o 47a antes e depois.
--  * b2b_clients: endereço (postal_code, street, address_number, address_complement, neighborhood) e, se faltarem,
--    document/city/state (o 35b já cria estes três)
--  * b2b_client_edits: histórico de cada alteração (quem, quando, valor antes/depois). NUNCA apaga cadastro.
-- Nenhum dado existente é alterado.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS document text;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS street text;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS address_complement text;
ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS neighborhood text;

CREATE TABLE IF NOT EXISTS b2b_client_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  changed_by text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changes jsonb NOT NULL,
  seq bigserial
);

CREATE INDEX IF NOT EXISTS b2b_client_edits_client_idx ON b2b_client_edits (client_id, changed_at DESC);

COMMIT;

SELECT 'ok' AS resultado;
