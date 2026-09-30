-- ============================================================================
-- BIO FLORAIS B2B — ADMIN: SQL CANDIDATO (aditivo, transação única)
-- ============================================================================
-- Rodar SÓ depois de revisar 03a_admin_preflight_one_shot.sql.
-- Somente ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
-- constraints NOT VALID condicionadas a pg_constraint. Sem DROP, sem
-- ALTER TYPE, sem UPDATE. Afeta apenas tabelas b2b_* (nenhuma rota B2C
-- lê estas tabelas).
--
-- Necessário ANTES do deploy desta branch: o schema.ts declara estas
-- colunas e as rotas do admin/convite/login B2B as leem.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Último acesso do vendedor/RCA (coluna "Último acesso" no admin).
ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS last_login_at timestamp;

-- Convite de cadastro x redefinição de acesso.
ALTER TABLE b2b_responsible_invites ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'onboarding';
ALTER TABLE b2b_responsible_invites ADD COLUMN IF NOT EXISTS responsible_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'b2b_responsible_invites_purpose_check') THEN
    ALTER TABLE b2b_responsible_invites
      ADD CONSTRAINT b2b_responsible_invites_purpose_check
      CHECK (purpose IN ('onboarding', 'password_reset'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'b2b_responsible_invites_responsible_fk') THEN
    ALTER TABLE b2b_responsible_invites
      ADD CONSTRAINT b2b_responsible_invites_responsible_fk
      FOREIGN KEY (responsible_id) REFERENCES b2b_responsibles (id)
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS b2b_responsible_invites_responsible_idx
  ON b2b_responsible_invites (responsible_id)
  WHERE responsible_id IS NOT NULL;

COMMIT;
