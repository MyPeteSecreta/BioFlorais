-- ============================================================================
-- BIO FLORAIS B2B — SQL CANDIDATO (candidata b2b/bio-limpa-v1)
-- ============================================================================
-- NÃO rodar antes de revisar o resultado de 01_preflight_readonly.sql.
-- NÃO usar drizzle-kit migrate/push; não há journal para isto.
--
-- Contém SOMENTE o que o código B2B precisa e pode faltar. Tudo é
-- idempotente (IF NOT EXISTS / checagem em pg_constraint): o que já
-- existir é mantido como está. Nenhum DROP, nenhum ALTER TYPE, nenhuma
-- escrita em linhas existentes (os DEFAULT de colunas novas são metadados).
--
-- As 14 tabelas b2b_* já existentes NÃO são recriadas aqui. Se o bloco [2]
-- do preflight listar alguma delas como faltando, PARE e revise antes.
--
-- Pré-condições (conferir no preflight):
--   * bloco [11] vazio (sem boleto duplicado por pedido);
--   * se orders.payment_method / coupons.scope já existirem, conferir tipo
--     e valores no bloco [3]/[4] — este script não os altera.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 1. orders: vínculo B2B + trava de forma de pagamento
--    (sem FK, igual às colunas b2b_* já existentes no banco real)
-- ---------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS b2b_client_id uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS b2b_offer_id uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS b2b_responsible_id uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS b2b_responsible_type text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS b2b_responsible_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method_discount_cents integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_b2b_payment_method_check') THEN
    -- NOT VALID: vale para linhas novas; não varre nem bloqueia as existentes.
    ALTER TABLE orders
      ADD CONSTRAINT orders_b2b_payment_method_check
      CHECK (payment_method IS NULL OR payment_method IN ('pix', 'card', 'boleto'))
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_b2b_offer_id_idx
  ON orders (b2b_offer_id)
  WHERE b2b_offer_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. coupons: escopo B2B x B2C (mutuamente exclusivos) + cupom de teste
--    que desconta frete (só percentual)
-- ---------------------------------------------------------------------------
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'b2c';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discounts_shipping boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coupons_scope_check') THEN
    ALTER TABLE coupons
      ADD CONSTRAINT coupons_scope_check
      CHECK (scope IN ('b2c', 'b2b'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coupons_discounts_shipping_percentage_check') THEN
    ALTER TABLE coupons
      ADD CONSTRAINT coupons_discounts_shipping_percentage_check
      CHECK (NOT discounts_shipping OR discount_type = 'percentage')
      NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Solicitação de boleto B2B (não emite boleto real)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS b2b_boleto_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id),
  amount_cents integer NOT NULL,
  installments integer NOT NULL DEFAULT 1,
  installment_amount_cents integer NOT NULL,
  last_installment_amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending_request',
  notes text,
  requested_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT b2b_boleto_requests_installments_check
    CHECK (installments BETWEEN 1 AND 3),
  CONSTRAINT b2b_boleto_requests_exact_composition_check
    CHECK (installment_amount_cents * (installments - 1) + last_installment_amount_cents = amount_cents)
);

-- Se a tabela já existia sem as colunas de parcelamento:
ALTER TABLE b2b_boleto_requests ADD COLUMN IF NOT EXISTS installments integer NOT NULL DEFAULT 1;
ALTER TABLE b2b_boleto_requests ADD COLUMN IF NOT EXISTS installment_amount_cents integer;
ALTER TABLE b2b_boleto_requests ADD COLUMN IF NOT EXISTS last_installment_amount_cents integer;

-- Idempotência garantida pelo banco (alvo do ON CONFLICT da rota de boleto).
CREATE UNIQUE INDEX IF NOT EXISTS b2b_boleto_requests_order_unique_idx
  ON b2b_boleto_requests (order_id);

-- Um registro de boleto por pedido em payments (não afeta Pix/cartão).
CREATE UNIQUE INDEX IF NOT EXISTS payments_boleto_order_unique_idx
  ON payments (order_id)
  WHERE method = 'boleto';

COMMIT;

-- ---------------------------------------------------------------------------
-- Conferência pós-execução (somente leitura): deve listar 'ok' em tudo.
-- ---------------------------------------------------------------------------
-- SELECT table_name, column_name, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND ((table_name = 'orders' AND column_name IN ('b2b_client_id','b2b_offer_id',
--          'b2b_responsible_id','b2b_responsible_type','b2b_responsible_name',
--          'payment_method','payment_method_discount_cents'))
--      OR (table_name = 'coupons' AND column_name IN ('scope','discounts_shipping'))
--      OR table_name = 'b2b_boleto_requests')
--  ORDER BY table_name, column_name;
