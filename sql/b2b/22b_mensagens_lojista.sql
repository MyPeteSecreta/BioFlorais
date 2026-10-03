-- ============================================================================
-- BIO FLORAIS B2B — 22b: mensagens de marketing ao lojista (C11)
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
--  * b2b_retailer_messages: título, texto, ativa, ordem (editável no admin B2B).
--  * b2b_retailer_popup_views: registra que o cliente JÁ viu o pop-up do 1º acesso
--    (uma linha por cliente; o pop-up não volta).
-- Seed editável: "Cliente gosta de novidade!" (só se a tabela estiver vazia).
-- Só aparece no link B2B do cliente; o B2C não lê estas tabelas.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS b2b_retailer_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS b2b_retailer_popup_views (
  client_id uuid PRIMARY KEY,
  message_id uuid,
  first_seen_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO b2b_retailer_messages (title, body, active, sort_order)
SELECT 'Cliente gosta de novidade!',
       'O que atrai clientes para a sua loja são produtos que chamam atenção. Saia do mais do mesmo e mostre que você oferece o melhor do mercado. Queremos você como parceiro: frete especial, pedido mínimo baixo, entrega rápida e facilidade de pagamento.',
       true, 10
 WHERE NOT EXISTS (SELECT 1 FROM b2b_retailer_messages);

SELECT title, active, sort_order FROM b2b_retailer_messages ORDER BY sort_order;
COMMIT;
