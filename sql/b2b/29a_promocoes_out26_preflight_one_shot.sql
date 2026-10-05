-- ============================================================================
-- BIO FLORAIS B2B — 29a: preflight das PROMOÇÕES REAIS de outubro/26
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Confere, ANTES do 29b:
--   * as promoções atuais (as que não são da tabela serão DESATIVADAS, nunca apagadas);
--   * quantas ofertas usam promoções que serão desativadas (só informa; continuam abrindo
--     pelo preço B2B normal e nenhum pedido muda);
--   * cada LINHA do alcance existe e tem produtos;
--   * o alcance por produto da B9 (sabonetes líquidos de Cosméticos, Spray para Hálito –
--     Menta de Cosméticos Pet, aromatizadores de Home Care): SKUs encontrados.
-- Se `pode_prosseguir` vier false, PARE: algum alcance não achou produto/linha.
-- ============================================================================
WITH linhas(slug) AS (
  VALUES ('adulto'), ('pet'), ('infantil'), ('baby'), ('kids'), ('teen'), ('dose-unica'),
         ('virtudes-divinas'), ('cosmeticos'), ('cosmeticos-pet'), ('home-care')
),
alvo_nomes(nome) AS (
  VALUES
    ('Compre 3 pague 2 · Florais'),
    ('10% de desconto · Florais'),
    ('Compre 4 pague 2 · Florais'),
    ('15% de desconto · Florais'),
    ('Compre 3 pague 1 · Florais Kids, Teen, Dose Única e Virtudes'),
    ('15% de desconto · Florais Kids, Teen, Dose Única e Virtudes'),
    ('Compre 1 ganhe mais 1 · Florais Kids, Teen, Dose Única e Virtudes'),
    ('20% de desconto · Florais Kids, Teen, Dose Única e Virtudes'),
    ('Compre 3 ganhe mais 1 · Sabonetes, Spray para Hálito e Aromatizadores'),
    ('8% de desconto · Cosméticos, Cosméticos Pet e Home Care'),
    ('10% de desconto · Cosméticos, Cosméticos Pet e Home Care')
),
checagem_linhas AS (
  SELECT l.slug,
         g.id IS NOT NULL AS grupo_existe,
         coalesce(g.active, false) AS ativa,
         coalesce(g.b2b_visible, false) AS visivel_b2b,
         (SELECT count(*) FROM b2b_commercial_group_products gp
            JOIN products p ON p.id = gp.product_id AND p.active
           WHERE gp.commercial_group_id = g.id) AS produtos_ativos
    FROM linhas l LEFT JOIN b2b_commercial_groups g ON g.slug = l.slug
),
b9 AS (
  SELECT 'Cosméticos → sabonetes líquidos' AS grupo, 'cosmeticos' AS linha, slug, name, active
    FROM products WHERE slug LIKE 'cosmeticos-sabonete-liquido-%'
  UNION ALL
  SELECT 'Cosméticos Pet → Spray para Hálito (Menta)', 'cosmeticos-pet', slug, name, active
    FROM products WHERE slug = 'cosmeticos-pet-higiene-oral-spray-para-halito-menta'
  UNION ALL
  SELECT 'Home Care → aromatizadores de ambiente', 'home-care', slug, name, active
    FROM products WHERE slug LIKE 'home-care-aromatizador-spray-%'
)
SELECT json_build_object(
  'pode_prosseguir', (
    SELECT bool_and(grupo_existe AND ativa AND visivel_b2b AND produtos_ativos > 0) FROM checagem_linhas
  ) AND (
    SELECT count(DISTINCT grupo) = 3 FROM b9 WHERE active
  ),
  'linhas', (
    SELECT json_agg(json_build_object('slug', slug, 'existe', grupo_existe, 'ativa', ativa,
                                      'visivel_b2b', visivel_b2b, 'produtos_ativos', produtos_ativos) ORDER BY slug)
      FROM checagem_linhas),
  'b9_skus', (
    SELECT json_agg(json_build_object('grupo', grupo, 'linha', linha, 'slug', slug, 'nome', name, 'ativo', active)
                    ORDER BY grupo, slug) FROM b9),
  'b9_total_por_grupo', (
    SELECT json_object_agg(grupo, total) FROM (SELECT grupo, count(*) FILTER (WHERE active) AS total FROM b9 GROUP BY grupo) x),
  'promocoes_atuais', (
    SELECT coalesce(json_agg(json_build_object(
             'id', p.id, 'name', p.name, 'type', p.type, 'promo_type', p.promo_type, 'active', p.active,
             'selecionavel', p.seller_selectable,
             'ofertas_que_usam', (SELECT count(*) FROM b2b_offer_promotions op WHERE op.promotion_id = p.id),
             'sera_desativada', p.name NOT IN (SELECT nome FROM alvo_nomes)) ORDER BY p.name), '[]'::json)
      FROM b2b_promotions p),
  'nomes_novos_que_ja_existem', (
    SELECT coalesce(json_agg(nome), '[]'::json) FROM alvo_nomes WHERE nome IN (SELECT name FROM b2b_promotions)),
  'ofertas_com_promocao_a_desativar', (
    SELECT count(DISTINCT op.offer_id) FROM b2b_offer_promotions op
      JOIN b2b_promotions p ON p.id = op.promotion_id WHERE p.name NOT IN (SELECT nome FROM alvo_nomes))
) AS preflight_promocoes_out26;
