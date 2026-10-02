-- ============================================================================
-- BIO FLORAIS B2B — 10a: confere a comissão congelada nos pedidos B2B
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Mostra os 10 pedidos B2B mais recentes (pagos ou não) com, por item,
-- base/extra/total gravados e a promoção do item, e a comissão ponderada do
-- pedido (por valor pago de cada item: unit_price_cents x paid_qty).
-- Bonificados (paid_qty = 0 em linha bonus) não pesam. Se algum item vier
-- com commission_*_percent NULL, o pedido foi criado SEM snapshot.
-- ============================================================================
SELECT json_build_object(
  'pedidos', (
    SELECT coalesce(json_agg(p ORDER BY p.created_at DESC), '[]'::json)
      FROM (
        SELECT o.id, o.status, o.payment_method, o.total_cents, o.created_at,
               o.b2b_offer_id, o.b2b_responsible_id,
               (SELECT count(*) FROM order_items i WHERE i.order_id = o.id) AS itens,
               (SELECT count(*) FROM order_items i
                 WHERE i.order_id = o.id AND i.commission_total_percent IS NULL) AS itens_sem_comissao,
               (SELECT round(sum(i.unit_price_cents::numeric * coalesce(i.paid_qty, i.qty) * i.commission_total_percent)
                             / nullif(sum(i.unit_price_cents::numeric * coalesce(i.paid_qty, i.qty)), 0), 2)
                  FROM order_items i
                 WHERE i.order_id = o.id AND i.commission_total_percent IS NOT NULL) AS comissao_ponderada_pct,
               (SELECT json_agg(json_build_object(
                         'produto', pr.slug, 'qty', i.qty, 'paid_qty', i.paid_qty, 'bonus_qty', i.bonus_qty,
                         'promocao', i.promotion_name, 'base', i.commission_base_percent,
                         'extra', i.commission_extra_percent, 'total', i.commission_total_percent))
                  FROM order_items i JOIN products pr ON pr.id = i.product_id
                 WHERE i.order_id = o.id) AS itens_detalhe
          FROM orders o
         WHERE o.b2b_offer_id IS NOT NULL
         ORDER BY o.created_at DESC
         LIMIT 10
      ) p
  )
) AS conferencia_comissao_b2b;
