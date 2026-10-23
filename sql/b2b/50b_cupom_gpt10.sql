-- ============================================================================
-- BIO FLORAIS — 50b: cupom GPT10 (campanha ChatGPT, Rodada 20). Projeto Neon: bio-florais.
-- SOMENTE ADITIVO (INSERT ... ON CONFLICT DO NOTHING), idempotente, transação única, linha final "ok". Rode o 50a antes e depois.
--  * GPT10: 10% de desconto, só B2C (scope 'b2c'), cupom comercial comum ('normal'), 1 uso por cliente (por E-MAIL: o modelo de
--    cupons guarda o e-mail em coupon_redemptions; CPF não é suportado pelo modelo), sem frete grátis/desconto no frete, sem mínimo,
--    sem limite global de usos, sem comissão. Válido até 30/11/2026 23:59:59 (Brasília) = 2026-12-01 02:59:59 UTC.
--  * Não acumula com outro cupom COMERCIAL: o checkout já aceita um único cupom comercial por pedido (o de parceira/UGC segue a
--    regra atual, calculado sobre o valor depois do comercial). Se o GPT10 já existir, nada é alterado.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

INSERT INTO coupons (code, discount_type, discount_value, coupon_type, scope, discounts_shipping, commission_percent, min_subtotal_cents, expires_at, one_per_customer, active)
VALUES ('GPT10', 'percentage', 10, 'normal', 'b2c', false, 0, 0, timestamp '2026-12-01 02:59:59', true, true)
ON CONFLICT (code) DO NOTHING;

COMMIT;

SELECT 'ok' AS resultado;
