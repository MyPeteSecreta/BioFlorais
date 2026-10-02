-- ============================================================================
-- BIO FLORAIS B2B — 18b: pagamento das comissões ao vendedor (C9)
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
-- b2b_commission_payouts: o admin marca a comissão de um pedido como PAGA ao
-- vendedor (data). Desfazer = apagar a linha pelo admin do app (registro em
-- undone_* fica em b2b_commission_payout_log). Nada em orders/order_items muda.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS b2b_commission_payouts (
  order_id uuid PRIMARY KEY REFERENCES orders (id),
  paid_at date NOT NULL,
  note text,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS b2b_commission_payout_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  action text NOT NULL,            -- 'paid' | 'undone'
  paid_at date,
  note text,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now()
);

SELECT table_name FROM information_schema.tables
 WHERE table_name IN ('b2b_commission_payouts', 'b2b_commission_payout_log') ORDER BY 1;
COMMIT;
