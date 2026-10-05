-- ============================================================================
-- BIO FLORAIS B2B — 26b: período de teste do vendedor (7 dias)
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
--  * trial_ends_at: cadastro rápido + 7 dias (null = cadastro antigo/completo).
--  * profile_completed_at: cadastro completo (documento, endereço, Pix/banco, termo).
--  * rca_terms_accepted_ip / rca_terms_version: prova do aceite do Termo RCA
--    (a data/hora já é rca_terms_accepted_at).
--  * Vendedores JÁ cadastrados com documento, endereço e Pix: marcados como completos
--    (só preenche a coluna nova; nenhum dado existente muda).
-- Rodar ANTES do deploy desta rodada (o app lê as colunas).
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS trial_ends_at timestamp;
ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS profile_completed_at timestamp;
ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS rca_terms_accepted_ip text;
ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS rca_terms_version text;

UPDATE b2b_responsibles
   SET profile_completed_at = coalesce(onboarding_completed_at, company_approved_at, created_at)
 WHERE profile_completed_at IS NULL
   AND (cpf IS NOT NULL OR cnpj IS NOT NULL)
   AND postal_code IS NOT NULL
   AND coalesce(pix_key, '') <> '';

SELECT count(*) FILTER (WHERE profile_completed_at IS NOT NULL) AS completos,
       count(*) FILTER (WHERE profile_completed_at IS NULL) AS sem_cadastro_completo,
       count(*) FILTER (WHERE trial_ends_at IS NOT NULL) AS em_teste
  FROM b2b_responsibles;
COMMIT;
