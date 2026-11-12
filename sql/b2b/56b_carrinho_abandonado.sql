-- ============================================================================
-- BIO FLORAIS — 56b: CARRINHO ABANDONADO (B2C). Projeto Neon: bio-florais.
-- SOMENTE ADITIVO, idempotente, transação única, sem UPDATE/DELETE. Rode o 56a antes.
--  * cart_recoveries: uma sacola por e-mail, gravada SÓ quando a cliente marca no checkout "Quero receber um lembrete por e-mail"
--    (consentimento, LGPD art. 7º, I). Guarda e-mail, primeiro nome, itens (slug, nome, quantidade) e as datas dos 2 envios.
--  * Sem a tabela, o site funciona igual e nenhum e-mail de sacola é enviado (src/lib/cart-recovery.ts).
--  * Retenção: a tarefa apaga sozinha a sacola 30 dias depois da última mudança, e na hora em que a pessoa pede para sair.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS cart_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text,
  items_json text NOT NULL,
  consent_at timestamp NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  reminder_sent_at timestamp,
  offer_sent_at timestamp,
  offer_code text,
  converted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cart_recoveries_email_uq ON cart_recoveries (lower(email));
CREATE INDEX IF NOT EXISTS cart_recoveries_pending_idx ON cart_recoveries (updated_at) WHERE converted_at IS NULL;

SELECT 'ok' AS resultado;

COMMIT;
