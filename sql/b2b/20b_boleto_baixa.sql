-- ============================================================================
-- BIO FLORAIS B2B — 20b: baixa de boletos por PARCELA (C10)
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
--  * b2b_boleto_payments: a BAIXA de cada parcela (data do pagamento, valor
--    pago, observação, quem fez). Uma linha por (pedido, parcela). Desfazer =
--    remover a linha pelo admin do app; tudo fica em b2b_boleto_payment_log.
--  * b2b_commission_payouts passa a ter `installment` (0 = pedido inteiro, como
--    Pix/cartão; 1..N = parcela do boleto) e a chave vira (order_id, installment):
--    a comissão do boleto é paga por parcela, no dia 10 do mês seguinte à BAIXA.
-- Cronograma (vencimento/valor) continua em b2b_boleto_requests.schedule.
-- Rodar ANTES do deploy desta rodada.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS b2b_boleto_payments (
  order_id uuid NOT NULL REFERENCES orders (id),
  installment integer NOT NULL,
  paid_at date NOT NULL,
  paid_cents integer NOT NULL,
  note text,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, installment)
);

CREATE TABLE IF NOT EXISTS b2b_boleto_payment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  installment integer NOT NULL,
  action text NOT NULL,            -- 'baixa' | 'desfeita'
  paid_at date,
  paid_cents integer,
  note text,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE b2b_commission_payouts ADD COLUMN IF NOT EXISTS installment integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'b2b_commission_payouts'::regclass AND contype = 'p'
       AND array_length(conkey, 1) = 1
  ) THEN
    ALTER TABLE b2b_commission_payouts DROP CONSTRAINT b2b_commission_payouts_pkey;
    ALTER TABLE b2b_commission_payouts ADD PRIMARY KEY (order_id, installment);
  END IF;
END $$;

SELECT table_name FROM information_schema.tables
 WHERE table_name IN ('b2b_boleto_payments', 'b2b_boleto_payment_log') ORDER BY 1;
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'b2b_commission_payouts' AND column_name = 'installment';
COMMIT;
