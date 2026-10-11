-- ============================================================================
-- BIO FLORAIS B2B — 36b: MODO DEMONSTRAÇÃO (vendedor temporário de 24 h, link de campanha gerado pelo admin).
-- Projeto Neon: bio-florais. SOMENTE ADITIVO, idempotente, transação única. Rode o 36a antes.
-- Nenhum dado existente muda: colunas novas (false/nulas) e duas tabelas novas.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS demo_expires_at timestamptz;
ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS demo_link_id uuid;

CREATE INDEX IF NOT EXISTS b2b_responsibles_demo_expires_idx
  ON b2b_responsibles (demo_expires_at) WHERE is_demo = true;

-- Link de campanha (só o hash do token fica no banco): um link serve para milhares de pessoas.
CREATE TABLE IF NOT EXISTS b2b_demo_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  max_accesses integer,
  accesses integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS b2b_demo_links_token_hash_uidx ON b2b_demo_links (token_hash);

-- Limite anti-abuso: no máximo 10 demonstrações por IP por hora (IP guardado só como hash).
CREATE TABLE IF NOT EXISTS b2b_demo_creations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  link_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS b2b_demo_creations_ip_idx ON b2b_demo_creations (ip_hash, created_at);

COMMIT;
