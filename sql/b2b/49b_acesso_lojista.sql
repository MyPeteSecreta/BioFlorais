-- ============================================================================
-- BIO FLORAIS — 49b: acesso do lojista sem senha (/b2b/entrar), Rodada 19c. Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única, linha final "ok". Rode o 49a antes e depois.
--  * b2b_access_requests: uma linha por pedido de "receber meu link" (para o limite de tentativas). Guarda só HASHES do
--    identificador (e-mail/CNPJ) e do IP, nunca o dado em claro. Nenhum dado existente é alterado.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS b2b_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_hash text NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS b2b_access_requests_identifier_idx ON b2b_access_requests (identifier_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS b2b_access_requests_ip_idx ON b2b_access_requests (ip_hash, created_at DESC);

COMMIT;

SELECT 'ok' AS resultado;
