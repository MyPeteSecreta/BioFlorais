-- ============================================================================
-- BIO FLORAIS B2B — 09b: cards das demais linhas da Bio (preço B2B normal)
-- Projeto Neon: bio-florais. Aditivo e idempotente, transação única.
-- Cria um grupo comercial por linha da Home que ainda não tem grupo, SOMENTE
-- se existir produto ativo com aquele products.line_slug, e liga os produtos
-- ativos ao grupo. Não cria promoção (a linha aparece só com preço B2B normal)
-- e não altera products (só lê). Rode antes o 08a e confira
-- "linhas_de_produto_ativas_sem_grupo".
-- ============================================================================
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

INSERT INTO b2b_commercial_groups (slug, name, active, b2c_visible, b2b_visible, sort_order)
SELECT v.slug, v.name, true, true, true, v.sort_order
  FROM (VALUES
    ('kids',             'Kids',              50),
    ('teen',             'Teen',              60),
    ('dose-unica',       'Dose Única',        70),
    ('virtudes-divinas', 'Virtudes Divinas',  80),
    ('cosmeticos',       'Cosméticos',        90),
    ('cosmeticos-pet',   'Cosméticos Pet',   100),
    ('home-care',        'Home Care',        110)
  ) AS v(slug, name, sort_order)
 WHERE EXISTS (SELECT 1 FROM products p WHERE p.line_slug = v.slug AND p.active)
   AND NOT EXISTS (SELECT 1 FROM b2b_commercial_groups g WHERE g.slug = v.slug);

INSERT INTO b2b_commercial_group_products (commercial_group_id, product_id)
SELECT g.id, p.id
  FROM b2b_commercial_groups g
  JOIN products p ON p.line_slug = g.slug AND p.active
 WHERE g.slug IN ('kids', 'teen', 'dose-unica', 'virtudes-divinas', 'cosmeticos', 'cosmeticos-pet', 'home-care')
   AND NOT EXISTS (
     SELECT 1 FROM b2b_commercial_group_products gp
      WHERE gp.commercial_group_id = g.id AND gp.product_id = p.id
   );

-- Conferência (esperado: cada linha nova com produtos > 0)
SELECT g.slug, g.name, g.active, g.b2b_visible,
       (SELECT count(*) FROM b2b_commercial_group_products gp WHERE gp.commercial_group_id = g.id) AS produtos
  FROM b2b_commercial_groups g
 ORDER BY g.sort_order, g.name;

COMMIT;
