-- ============================================================================
-- BIO FLORAIS B2B — 16b: elegibilidades PADRÃO para promoções ativas sem regra
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única. Sem DELETE.
-- Só para promoção ativa SEM nenhuma regra geral, com paga 2 + grátis 1 ("3 por 2")
-- ou paga 2 + grátis 2 ("4 por 2"): cria as 7 regras da tabela fechada
-- (compras 1/2/3 e dias 30/60/90/180). Outras combinações NÃO são tocadas: o
-- admin define na aba Promoções (campo "Elegibilidades e comissão extra").
-- Rode o 16a antes e confira a lista.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

INSERT INTO b2b_commission_rules
  (scope, promotion_id, eligibility_mode, max_uses, duration_days, extra_percent)
SELECT 'promotion_eligibility', p.id, v.mode, v.max_uses, v.duration_days,
       CASE WHEN p.free_quantity = 1 THEN v.extra_free1 ELSE v.extra_free2 END
  FROM b2b_promotions p
  CROSS JOIN (VALUES
    ('uses', 1, NULL::int, 10, 6), ('uses', 2, NULL, 8, 4), ('uses', 3, NULL, 6, 2),
    ('days', NULL::int, 30, 10, 6), ('days', NULL, 60, 8, 4), ('days', NULL, 90, 6, 2), ('days', NULL, 180, 3, 1)
  ) AS v(mode, max_uses, duration_days, extra_free1, extra_free2)
 WHERE p.active AND p.buy_quantity = 2 AND p.free_quantity IN (1, 2)
   AND NOT EXISTS (
     SELECT 1 FROM b2b_commission_rules r
      WHERE r.scope = 'promotion_eligibility' AND r.promotion_id = p.id AND r.active
        AND r.responsible_id IS NULL AND r.client_id IS NULL);

SELECT p.name, count(r.id) AS regras
  FROM b2b_promotions p
  LEFT JOIN b2b_commission_rules r ON r.promotion_id = p.id AND r.scope = 'promotion_eligibility' AND r.active
 WHERE p.active GROUP BY p.name ORDER BY p.name;

COMMIT;
