-- ============================================================================
-- BIO FLORAIS B2B — 13a: confere o contador de usos das promoções (2x/3x)
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Por promoção de oferta: uses_count (contador), max_uses e quantos pedidos
-- realmente receberam bonificação dela, separados por status. O contador sobe
-- na CRIAÇÃO do pedido (1 por pedido com bonificação), então
-- uses_count = pedidos_pagos + pedidos_nao_pagos (pendentes/cancelados contam).
-- ============================================================================
SELECT json_build_object(
  'promocoes_das_ofertas', (
    SELECT coalesce(json_agg(json_build_object(
             'offer_id', op.offer_id, 'promocao', p.name, 'modo', op.eligibility_mode,
             'max_uses', op.max_uses, 'uses_count', op.uses_count,
             'pedidos_com_bonificacao', x.total,
             'pedidos_pagos', x.pagos,
             'pedidos_nao_pagos', x.total - x.pagos,
             'divergente', op.uses_count <> x.total
           ) ORDER BY op.offer_id, p.name), '[]'::json)
      FROM b2b_offer_promotions op
      JOIN b2b_promotions p ON p.id = op.promotion_id
      CROSS JOIN LATERAL (
        SELECT count(DISTINCT o.id)::int AS total,
               count(DISTINCT o.id) FILTER (WHERE o.status = 'paid')::int AS pagos
          FROM orders o
          JOIN order_items i ON i.order_id = o.id
         WHERE o.b2b_offer_id = op.offer_id
           AND i.promotion_id = op.promotion_id::text
           AND coalesce(i.bonus_qty, 0) > 0
      ) x
  )
) AS conferencia_contador_de_usos;
