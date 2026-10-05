-- ============================================================================
-- BIO FLORAIS B2B — 27b: vendedores antigos com cadastro INCOMPLETO ganham teste
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
-- Quem não tem prazo (trial_ends_at nulo), não tem cadastro completo e não tem
-- documento + CEP + Pix passa a ter trial_ends_at = AGORA (data do SQL) + 7 dias:
-- banner no painel e comissão retida até completar. Só preenche a coluna onde
-- ela está nula; nenhum outro dado muda. Rodar de novo não faz nada. Rode depois do 26b.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

UPDATE b2b_responsibles
   SET trial_ends_at = (now() AT TIME ZONE 'UTC') + interval '7 days'
 WHERE trial_ends_at IS NULL
   AND profile_completed_at IS NULL
   AND NOT ((cpf IS NOT NULL OR cnpj IS NOT NULL) AND postal_code IS NOT NULL AND coalesce(pix_key, '') <> '');

SELECT id, name, status, trial_ends_at FROM b2b_responsibles WHERE trial_ends_at IS NOT NULL ORDER BY name;
COMMIT;
