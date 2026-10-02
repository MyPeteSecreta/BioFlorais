-- ============================================================================
-- BIO FLORAIS B2B — 15a: contador de usos ANTIGO (uses_count) x REGRA NOVA (R4/R5)
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Regra nova: usos = pedidos da oferta que receberam bonificação da promoção e
-- contam como compra (pago, ou boleto gerado e não cancelado) ou reservam
-- (Pix/cartão pendente criado há menos de 60 min).
-- uses_count (gravado na criação do pedido) deixa de ser usado pelo app.
-- ============================================================================
SELECT json_build_object(
  'promocoes_das_ofertas', (
    SELECT coalesce(json_agg(json_build_object(
             'offer_id', op.offer_id, 'promocao', p.name, 'tipo', p.promo_type, 'modo', op.eligibility_mode,
             'max_uses', op.max_uses, 'uses_count_antigo', op.uses_count,
             'usos_regra_nova', x.novo, 'pagos_ou_boleto', x.compras, 'reservas_pendentes', x.reservas,
             'pedidos_descartados', x.descartados,
             'divergente', op.uses_count <> x.novo
           ) ORDER BY op.offer_id, p.name), '[]'::json)
      FROM b2b_offer_promotions op
      JOIN b2b_promotions p ON p.id = op.promotion_id
      CROSS JOIN LATERAL (
        SELECT count(DISTINCT o.id) FILTER (WHERE
                 o.status = 'paid'
                 OR (o.payment_method = 'boleto'
                     AND o.status NOT IN ('cancelled','canceled','failed','expired','refunded','rejected')
                     AND EXISTS (SELECT 1 FROM b2b_boleto_requests br WHERE br.order_id = o.id)))::int AS compras,
               count(DISTINCT o.id) FILTER (WHERE
                 o.status = 'pending' AND o.payment_method IN ('pix', 'card')
                 AND o.created_at > ((now() AT TIME ZONE 'UTC') - interval '60 minutes'))::int AS reservas,
               count(DISTINCT o.id)::int AS total
          FROM orders o JOIN order_items i ON i.order_id = o.id
         WHERE o.b2b_offer_id = op.offer_id AND i.promotion_id = op.promotion_id::text AND coalesce(i.bonus_qty, 0) > 0
      ) base
      CROSS JOIN LATERAL (
        SELECT base.compras + base.reservas AS novo, base.compras, base.reservas, base.total - base.compras - base.reservas AS descartados
      ) x
  )
) AS conferencia_contador_novo;
