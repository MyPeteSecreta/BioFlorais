-- ============================================================================
-- BIO FLORAIS B2B — 28b: colunas do perfil do vendedor passam a ser opcionais
-- Projeto Neon: bio-florais. Idempotente, transação única, sem apagar nada.
-- O cadastro rápido grava só nome, WhatsApp, e-mail, senha e o prazo de teste; documento,
-- endereço e Pix vêm no cadastro completo. Se o banco tiver alguma dessas colunas como
-- NOT NULL (legado), o cadastro rápido falha. Aqui só se REMOVE o NOT NULL das colunas do
-- perfil (nenhum dado muda). Rode o 28a antes para ver quais colunas são afetadas.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'phone', 'cpf', 'rg', 'cnpj', 'state_registration', 'pix_key', 'bank_name', 'bank_agency',
    'bank_account', 'postal_code', 'street', 'address_number', 'address_complement',
    'neighborhood', 'city', 'state', 'login', 'password_hash', 'company_approved_at',
    'onboarding_completed_at', 'rca_terms_accepted_at', 'invite_id'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_name = 'b2b_responsibles' AND column_name = col AND is_nullable = 'NO'
    ) THEN
      EXECUTE format('ALTER TABLE b2b_responsibles ALTER COLUMN %I DROP NOT NULL', col);
    END IF;
  END LOOP;
END $$;

SELECT column_name FROM information_schema.columns
 WHERE table_name = 'b2b_responsibles' AND is_nullable = 'NO' AND column_default IS NULL
 ORDER BY ordinal_position;  -- esperado: id, type, name, email
COMMIT;
