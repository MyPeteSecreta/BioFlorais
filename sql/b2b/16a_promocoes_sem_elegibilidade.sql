-- ============================================================================
-- BIO FLORAIS B2B — 16a: promoções ativas SEM elegibilidade (não selecionáveis)
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Promoção criada no admin antes desta rodada não tem regra em
-- b2b_commission_rules: o vendedor vê o card mas não consegue clicar nem
-- escolher 1x/2x/3x/30/60/90/180 dias (C1).
-- ============================================================================
SELECT json_build_object(
  'promocoes_ativas_sem_elegibilidade', (
    SELECT coalesce(json_agg(json_build_object('id', p.id, 'name', p.name, 'paga', p.buy_quantity,
             'gratis', p.free_quantity, 'tipo', p.promo_type, 'seller_selectable', p.seller_selectable)
             ORDER BY p.name), '[]'::json)
      FROM b2b_promotions p
     WHERE p.active
       AND NOT EXISTS (
         SELECT 1 FROM b2b_commission_rules r
          WHERE r.scope = 'promotion_eligibility' AND r.promotion_id = p.id AND r.active
            AND r.responsible_id IS NULL AND r.client_id IS NULL)
  ),
  'regras_por_promocao', (
    SELECT coalesce(json_agg(json_build_object('promocao', p.name, 'regras', x.total) ORDER BY p.name), '[]'::json)
      FROM b2b_promotions p
      JOIN LATERAL (SELECT count(*)::int AS total FROM b2b_commission_rules r
                     WHERE r.scope = 'promotion_eligibility' AND r.promotion_id = p.id AND r.active) x ON true
  )
) AS promocoes_sem_elegibilidade;
