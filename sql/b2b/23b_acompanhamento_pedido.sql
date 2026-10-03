-- ============================================================================
-- BIO FLORAIS — 23b: acompanhamento do pedido (B2C e B2B) — Rodada 4
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
--  * order_events: histórico do andamento do pedido (em separação, enviado,
--    entregue) com transportadora, rastreio, link, data, quem fez. A data de
--    "entregue" fica gravada (útil depois para a Academia/UGC).
--  * order_tracking_attempts: limita as tentativas de busca na página pública
--    "Acompanhe seu pedido" (5 a cada 10 min por IP; só guarda o hash do IP).
-- Nada em orders/order_items/payments muda. Pode rodar antes ou depois do deploy
-- (sem as tabelas a página funciona, sem histórico e com limite em memória).
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id),
  event text NOT NULL,              -- 'separating' | 'shipped' | 'delivered'
  carrier text,
  tracking_code text,
  tracking_url text,
  note text,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id, created_at);

CREATE TABLE IF NOT EXISTS order_tracking_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  attempted_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_tracking_attempts_ip_idx ON order_tracking_attempts (ip_hash, attempted_at);

SELECT table_name FROM information_schema.tables
 WHERE table_name IN ('order_events', 'order_tracking_attempts') ORDER BY 1;
COMMIT;
