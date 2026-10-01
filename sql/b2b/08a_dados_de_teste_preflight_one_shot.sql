-- ============================================================================
-- BIO FLORAIS B2B — 08a: procura registros de TESTE no banco (SOMENTE LEITURA)
-- Projeto Neon: bio-florais. Uma consulta, uma linha, uma coluna json.
-- Procura "test"/"teste" em linhas (grupos comerciais), promoções, produtos,
-- clientes B2B, vendedores e cupons, e mostra as ofertas mais recentes com
-- as linhas e promoções gravadas (diagnóstico do "link sem promoção").
-- ============================================================================
SELECT json_build_object(
  'grupos_teste', (
    SELECT coalesce(json_agg(json_build_object(
             'id', g.id, 'slug', g.slug, 'name', g.name, 'active', g.active,
             'b2b_visible', g.b2b_visible, 'b2c_visible', g.b2c_visible,
             'produtos', (SELECT count(*) FROM b2b_commercial_group_products gp WHERE gp.commercial_group_id = g.id),
             'ofertas', (SELECT count(*) FROM b2b_offer_commercial_groups og WHERE og.commercial_group_id = g.id)
           ) ORDER BY g.name), '[]'::json)
      FROM b2b_commercial_groups g
     WHERE g.name ILIKE '%test%' OR g.slug ILIKE '%test%'
  ),
  'promocoes_teste', (
    SELECT coalesce(json_agg(json_build_object('id', id, 'name', name, 'active', active)), '[]'::json)
      FROM b2b_promotions WHERE name ILIKE '%test%'
  ),
  'produtos_teste', (
    SELECT coalesce(json_agg(json_build_object('id', id, 'slug', slug, 'name', name, 'active', active)), '[]'::json)
      FROM products WHERE name ILIKE '%test%' OR slug ILIKE '%test%'
  ),
  'clientes_b2b_teste', (
    SELECT coalesce(json_agg(json_build_object('id', id, 'display_name', display_name, 'active', active)), '[]'::json)
      FROM b2b_clients WHERE display_name ILIKE '%test%'
  ),
  'vendedores_teste', (
    SELECT coalesce(json_agg(json_build_object('id', id, 'name', name, 'email', email, 'status', status)), '[]'::json)
      FROM b2b_responsibles WHERE name ILIKE '%test%' OR email ILIKE '%test%'
  ),
  'cupons_teste', (
    SELECT coalesce(json_agg(to_jsonb(c) - 'id'), '[]'::json)
      FROM coupons c WHERE to_jsonb(c)::text ILIKE '%teste%'
  ),
  'todos_os_grupos', (
    SELECT coalesce(json_agg(json_build_object('slug', slug, 'name', name, 'active', active,
                                               'b2b_visible', b2b_visible) ORDER BY sort_order, name), '[]'::json)
      FROM b2b_commercial_groups
  ),
  'linhas_de_produto_ativas_sem_grupo', (
    SELECT coalesce(json_agg(json_build_object('line_slug', line_slug, 'produtos', total) ORDER BY line_slug), '[]'::json)
      FROM (SELECT p.line_slug, count(*) AS total
              FROM products p
             WHERE p.active AND p.line_slug IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM b2b_commercial_groups g WHERE g.slug = p.line_slug)
             GROUP BY p.line_slug) x
  ),
  'ofertas_recentes', (
    SELECT coalesce(json_agg(json_build_object(
             'offer_id', o.id, 'status', o.status, 'activated_at', o.activated_at, 'created_at', o.created_at,
             'linhas', (SELECT coalesce(json_agg(g.name ORDER BY g.name), '[]'::json)
                          FROM b2b_offer_commercial_groups og JOIN b2b_commercial_groups g ON g.id = og.commercial_group_id
                         WHERE og.offer_id = o.id),
             'promocoes', (SELECT coalesce(json_agg(json_build_object(
                                    'promocao', p.name, 'linha_id', op.commercial_group_id,
                                    'modo', op.eligibility_mode, 'max_uses', op.max_uses,
                                    'dias', op.duration_days, 'valid_until', op.valid_until)), '[]'::json)
                             FROM b2b_offer_promotions op JOIN b2b_promotions p ON p.id = op.promotion_id
                            WHERE op.offer_id = o.id)
           ) ORDER BY o.created_at DESC), '[]'::json)
      FROM (SELECT * FROM b2b_offers ORDER BY created_at DESC LIMIT 10) o
  ),
  'offer_promotions_total', (SELECT count(*) FROM b2b_offer_promotions)
) AS preflight_dados_de_teste;
