-- ============================================================================
-- BIO FLORAIS B2B — 53b: AUDITORIA do contato do vendedor (nome e WhatsApp). Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única, sem DELETE de dados.
-- Cada troca de nome ou de WhatsApp (pelo admin em Vendedores > Editar, ou pelo próprio vendedor em Meu cadastro) grava uma linha:
-- quem (admin ou o vendedor), quando, o valor antigo e o novo.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS b2b_responsible_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responsible_id uuid NOT NULL REFERENCES b2b_responsibles(id),
  field text NOT NULL,
  old_value text,
  new_value text,
  actor text NOT NULL,
  actor_label text,
  changed_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS b2b_responsible_audit_responsible_idx ON b2b_responsible_audit (responsible_id, changed_at DESC);

-- Conferência
SELECT count(*) AS alteracoes_registradas FROM b2b_responsible_audit;

COMMIT;
