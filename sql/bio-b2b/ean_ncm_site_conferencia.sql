-- ============================================================================
-- BIO FLORAIS - CONFERENCIA DO EAN/NCM NO SITE (ean_ncm_site_conferencia.sql, 22/11/2026). ASCII. SO LEITURA (nenhum INSERT/UPDATE).
-- Rodar ANTES e DEPOIS do ean_ncm_site.sql, no Neon da BIO (nunca na My Pet nem na Secreta). Devolve UMA linha de texto JSON.
-- ANTES esperado: colunas_ean_ncm=false, produtos_encontrados=78, com_o_ean_certo=0.
-- DEPOIS esperado: colunas_ean_ncm=true, com_o_ean_certo=78, aromatizador_com_300g=5, as tres listas vazias [].
-- ============================================================================
WITH esperado(slug, ean, ncm) AS (VALUES
  ('adulto-floral-em-gotas-reequilibrio-dos-chakras', '7898919557295', '1302.19.99'),
  ('adulto-flormed-ansiedade', '7898552637040', '1302.19.99'),
  ('adulto-flormed-sono', '7898552636975', '1302.19.99'),
  ('adulto-flormed-stress', '7898552636678', '1302.19.99'),
  ('baby-floral-em-gotas-mamae-volta-ao-trabalho', '7898552630201', '1302.19.99'),
  ('baby-flormed-kolin-k', '7898552630553', '1302.19.99'),
  ('baby-flormed-ninar', '7898552630546', '1302.19.99'),
  ('baby-flormed-ninni-chorim', '7898552630539', '1302.19.99'),
  ('cosmeticos-creme-corpo-ansiedade', '7898919558919', '3304.99.10'),
  ('cosmeticos-creme-corpo-harmonia-interior', '7898919558926', '3304.99.10'),
  ('cosmeticos-creme-corpo-hidratante', '7898552633585', '3304.99.10'),
  ('cosmeticos-creme-corpo-reequilibrio-dos-chakras', '7898919558933', '3304.99.10'),
  ('cosmeticos-creme-corpo-rescue-sos', '7898552633608', '3304.99.10'),
  ('cosmeticos-pet-condicionador-adestramento-5l', '7898552631161', '3305.90.00'),
  ('cosmeticos-pet-condicionador-agressividade-5l', '7898552631109', '3305.90.00'),
  ('cosmeticos-pet-condicionador-ansiedade-pelos-claros-5l', '7898552631147', '3305.90.00'),
  ('cosmeticos-pet-condicionador-ansiedade-pelos-escuros-5l', '7898552631130', '3305.90.00'),
  ('cosmeticos-pet-condicionador-filhotes-5l', '7898552631154', '3305.90.00'),
  ('cosmeticos-pet-condicionador-lambedura-5l', '7898552631116', '3305.90.00'),
  ('cosmeticos-pet-condicionador-rescue-sos', '7898552630867', '3305.90.00'),
  ('cosmeticos-pet-condicionador-rescue-sos-5l', '7898552631178', '3305.90.00'),
  ('cosmeticos-pet-condicionador-tristeza-e-depressao-5l', '7898552631123', '3305.90.00'),
  ('cosmeticos-pet-floral-de-ambiente-adestramento', '7898552630973', '1302.19.99'),
  ('cosmeticos-pet-floral-de-ambiente-agressividade', '7898552630935', '1302.19.99'),
  ('cosmeticos-pet-floral-de-ambiente-filhotes', '7898552630966', '1302.19.99'),
  ('cosmeticos-pet-floral-de-ambiente-rescue-sos', '7898552630959', '1302.19.99'),
  ('cosmeticos-pet-floral-de-ambiente-tristeza-e-depressao', '7898552630928', '1302.19.99'),
  ('cosmeticos-pet-higiene-oral-spray-para-halito-menta', '7898552630997', '3306.10.00'),
  ('cosmeticos-pet-perfume-spray-agressividade', '7898552630881', '3307.90.00'),
  ('cosmeticos-pet-perfume-spray-agressividade-500ml', '7898552631192', '3307.90.00'),
  ('cosmeticos-pet-perfume-spray-ansiedade', '7898552630898', '3307.90.00'),
  ('cosmeticos-pet-perfume-spray-ansiedade-500ml', '7898552631208', '3307.90.00'),
  ('cosmeticos-pet-perfume-spray-filhotes', '7898552630911', '3307.90.00'),
  ('cosmeticos-pet-perfume-spray-filhotes-500ml', '7898552631222', '3307.90.00'),
  ('cosmeticos-pet-perfume-spray-rescue-sos', '7898552630904', '3307.90.00'),
  ('cosmeticos-pet-perfume-spray-rescue-sos-500ml', '7898552631215', '3307.90.00'),
  ('cosmeticos-pet-perfume-spray-tristeza-e-depressao', '7898552630874', '3307.90.00'),
  ('cosmeticos-pet-perfume-spray-tristeza-e-depressao-500ml', '7898552631185', '3307.90.00'),
  ('cosmeticos-pet-shampoo-adestramento-5l', '7898552631086', '3307.90.00'),
  ('cosmeticos-pet-shampoo-agressividade-5l', '7898552631024', '3307.90.00'),
  ('cosmeticos-pet-shampoo-ansiedade-pelos-claros-5l', '7898552631062', '3307.90.00'),
  ('cosmeticos-pet-shampoo-ansiedade-pelos-escuros-5l', '7898552631055', '3307.90.00'),
  ('cosmeticos-pet-shampoo-filhotes-5l', '7898552631079', '3307.90.00'),
  ('cosmeticos-pet-shampoo-lambedura-5l', '7898552631031', '3307.90.00'),
  ('cosmeticos-pet-shampoo-rescue-sos', '7898552630782', '3307.90.00'),
  ('cosmeticos-pet-shampoo-rescue-sos-5l', '7898552631093', '3307.90.00'),
  ('cosmeticos-pet-shampoo-tristeza-e-depressao-5l', '7898552631048', '3307.90.00'),
  ('cosmeticos-sabonete-liquido-alegria', '7898919558551', '3401.20.10'),
  ('cosmeticos-sabonete-liquido-ansiedade', '7898919558568', '3401.20.10'),
  ('cosmeticos-sabonete-liquido-harmonia-interior', '7898919558599', '3401.20.10'),
  ('cosmeticos-sabonete-liquido-hidratante', '7898919558605', '3401.20.10'),
  ('cosmeticos-sabonete-liquido-reequilibrio-dos-chakras', '7898919558612', '3401.20.10'),
  ('cosmeticos-sabonete-liquido-refrescante', '7898919558629', '3401.20.10'),
  ('cosmeticos-sabonete-liquido-relaxante', '7898919558636', '3401.20.10'),
  ('cosmeticos-sabonete-liquido-rescue-sos', '7898919558643', '3401.20.10'),
  ('cosmeticos-shampoo-masculino-cabelos-grisalhos-premium', '7898552636616', '3305.10.00'),
  ('home-care-aromatizador-spray-bem-estar', '7898919558209', '1302.19.99'),
  ('home-care-aromatizador-spray-harmonia', '7898919558223', '1302.19.99'),
  ('home-care-aromatizador-spray-limpeza-e-protecao', '7898919558216', '1302.19.99'),
  ('home-care-aromatizador-spray-reequilibrio-do-ambiente', '7898919558247', '1302.19.99'),
  ('home-care-aromatizador-spray-serenidade', '7898919558230', '1302.19.99'),
  ('home-care-sabonete-liquido-alegria', '7898919558551', '3401.20.10'),
  ('home-care-sabonete-liquido-ansiedade', '7898919558568', '3401.20.10'),
  ('home-care-sabonete-liquido-harmonia-interior', '7898919558599', '3401.20.10'),
  ('home-care-sabonete-liquido-hidratante', '7898919558605', '3401.20.10'),
  ('home-care-sabonete-liquido-reequilibrio-dos-chakras', '7898919558612', '3401.20.10'),
  ('home-care-sabonete-liquido-refrescante', '7898919558629', '3401.20.10'),
  ('home-care-sabonete-liquido-relaxante', '7898919558636', '3401.20.10'),
  ('home-care-sabonete-liquido-rescue-sos', '7898919558643', '3401.20.10'),
  ('pet-floral-em-gotas-s-o-s', '7898919557349', '1302.19.99'),
  ('pet-floral-em-gotas-viagens', '7898552633905', '1302.19.99'),
  ('pet-snack-floral-agressividade', '7898552637583', '1302.19.99'),
  ('pet-snack-floral-ansiedade', '7898552637576', '1302.19.99'),
  ('pet-snack-floral-filhotes', '7898552637620', '1302.19.99'),
  ('pet-snack-floral-hiperatividade', '7898552637590', '1302.19.99'),
  ('pet-snack-floral-lambedura', '7898552637606', '1302.19.99'),
  ('pet-snack-floral-medo', '7898552637613', '1302.19.99'),
  ('teen-floral-em-gotas-rescue-s-o-s', '7898552630423', '1302.19.99')
),
tem_colunas AS (
  SELECT count(*) = 2 AS ok FROM information_schema.columns
   WHERE table_schema = current_schema() AND table_name = 'products' AND column_name IN ('ean', 'ncm')
),
achados AS (
  SELECT e.slug, p.id IS NOT NULL AS existe
    FROM esperado e LEFT JOIN products p ON p.slug = e.slug
)
SELECT json_build_object(
  'colunas_ean_ncm', (SELECT ok FROM tem_colunas),
  'produtos_esperados', (SELECT count(*) FROM esperado),
  'produtos_encontrados', (SELECT count(*) FROM achados WHERE existe),
  'slugs_nao_encontrados', COALESCE((SELECT json_agg(slug ORDER BY slug) FROM achados WHERE NOT existe), '[]'::json),
  'com_o_ean_certo', CASE WHEN (SELECT ok FROM tem_colunas)
      THEN (SELECT count(*) FROM esperado e JOIN products p ON p.slug = e.slug WHERE to_jsonb(p) ->> 'ean' = e.ean AND to_jsonb(p) ->> 'ncm' = e.ncm)
      ELSE 0 END,
  'ean_diferente_do_esperado', CASE WHEN (SELECT ok FROM tem_colunas)
      THEN COALESCE((SELECT json_agg(e.slug ORDER BY e.slug) FROM esperado e JOIN products p ON p.slug = e.slug WHERE COALESCE(to_jsonb(p) ->> 'ean', '') <> e.ean), '[]'::json)
      ELSE '[]'::json END,
  'ean_repetido_na_mesma_linha', CASE WHEN (SELECT ok FROM tem_colunas)
      THEN COALESCE((SELECT json_agg(x.ean) FROM (SELECT to_jsonb(p) ->> 'ean' AS ean FROM products p WHERE COALESCE(to_jsonb(p) ->> 'ean', '') <> '' GROUP BY coalesce(p.line_slug, ''), to_jsonb(p) ->> 'ean' HAVING count(*) > 1) x), '[]'::json)
      ELSE '[]'::json END,
  'aromatizador_com_300g', (SELECT count(*) FROM products WHERE slug IN ('home-care-aromatizador-spray-bem-estar', 'home-care-aromatizador-spray-harmonia', 'home-care-aromatizador-spray-limpeza-e-protecao', 'home-care-aromatizador-spray-reequilibrio-do-ambiente', 'home-care-aromatizador-spray-serenidade') AND weight_grams = 300),
  'aromatizador_pesos_atuais', COALESCE((SELECT json_agg(json_build_object('slug', slug, 'peso_g', weight_grams) ORDER BY slug) FROM products WHERE slug IN ('home-care-aromatizador-spray-bem-estar', 'home-care-aromatizador-spray-harmonia', 'home-care-aromatizador-spray-limpeza-e-protecao', 'home-care-aromatizador-spray-reequilibrio-do-ambiente', 'home-care-aromatizador-spray-serenidade')), '[]'::json)
)::text AS conferencia;
