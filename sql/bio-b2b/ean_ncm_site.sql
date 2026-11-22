-- ============================================================================
-- BIO FLORAIS - EAN e NCM NOVOS NO SITE (ean_ncm_site.sql, 22/11/2026). ASCII. SOMENTE ADITIVO, idempotente, transacao unica,
-- termina em "ok". Neon: projeto da BIO FLORAIS. NAO EXECUTAR sem: 1) backup (branch no Neon), 2) a conferencia
-- "ean_ncm_site_conferencia.sql" colada ANTES e DEPOIS, 3) autorizacao do Luis. Nunca rodar na My Pet nem na Secreta (colunas diferentes).
--
-- O banco da Bio NAO tinha coluna de EAN/NCM em products (colunas reais: id, slug, name, line_slug, category, price_cents, weight_grams,
-- length_cm, width_cm, height_cm, active, image_url, created_at). Este SQL:
--   1) CRIA products.ean e products.ncm (ADD COLUMN IF NOT EXISTS; nada e removido);
--   2) cria indice UNICO parcial em (line_slug, ean): dois produtos da MESMA linha nunca dividem o EAN. O Sabonete Liquido existe em 2
--      linhas (cosmeticos e home-care) e e o mesmo produto de 315 ml, entao la o EAN se repete de proposito (linhas diferentes);
--   3) grava EAN e NCM de 78 produtos (70 EAN diferentes). Provisorios: Creme Corpo Hidratante e Creme Corpo S.O.S.;
--   4) Aromatizador Spray (5 produtos de home-care): peso 300 g (nao existe 50 g; o volume 240 ml fica no codigo). So UPDATE de
--      weight_grams quando for diferente de 300; nenhum outro campo muda;
--   5) confere que os 78 slugs existem e ficaram com o EAN certo; se faltar algum, a transacao e DESFEITA (RAISE) e nada fica gravado.
-- Fonte: marketplaces/EAN_NCM_MESTRE_21_11.json (marca "Bio Florais"), digito verificador conferido. Mesma lista de src/lib/catalog/ean.ts.
-- O codigo do site NAO le estas colunas (le a lista do codigo), entao o push nao depende da ordem; as colunas servem ao Omie/marketplaces.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ean" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ncm" text;
CREATE UNIQUE INDEX IF NOT EXISTS "bio_products_line_ean_unique" ON "products" (coalesce("line_slug", ''), "ean") WHERE "ean" IS NOT NULL AND btrim("ean") <> '';

CREATE TEMP TABLE IF NOT EXISTS _ean_novos (slug text PRIMARY KEY, ean text NOT NULL, ncm text NOT NULL);
INSERT INTO _ean_novos (slug, ean, ncm) VALUES
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
ON CONFLICT (slug) DO UPDATE SET ean = EXCLUDED.ean, ncm = EXCLUDED.ncm;

UPDATE "products" p
   SET "ean" = n.ean,
       "ncm" = n.ncm
  FROM _ean_novos n
 WHERE p.slug = n.slug
   AND (p."ean" IS DISTINCT FROM n.ean OR p."ncm" IS DISTINCT FROM n.ncm);

UPDATE "products"
   SET "weight_grams" = 300
 WHERE slug IN ('home-care-aromatizador-spray-bem-estar', 'home-care-aromatizador-spray-harmonia', 'home-care-aromatizador-spray-limpeza-e-protecao', 'home-care-aromatizador-spray-reequilibrio-do-ambiente', 'home-care-aromatizador-spray-serenidade')
   AND "weight_grams" IS DISTINCT FROM 300;

DO $$
DECLARE ok_count integer;
DECLARE peso_ok integer;
BEGIN
  SELECT count(*) INTO ok_count FROM "products" p JOIN _ean_novos n ON n.slug = p.slug AND p."ean" = n.ean AND p."ncm" = n.ncm;
  IF ok_count <> 78 THEN
    RAISE EXCEPTION 'EAN: esperava 78 produtos com o EAN novo e achei % (algum slug nao existe no banco). Nada foi gravado.', ok_count;
  END IF;
  SELECT count(*) INTO peso_ok FROM "products" WHERE slug IN ('home-care-aromatizador-spray-bem-estar', 'home-care-aromatizador-spray-harmonia', 'home-care-aromatizador-spray-limpeza-e-protecao', 'home-care-aromatizador-spray-reequilibrio-do-ambiente', 'home-care-aromatizador-spray-serenidade') AND "weight_grams" = 300;
  IF peso_ok <> 5 THEN
    RAISE EXCEPTION 'Aromatizador: esperava 5 produtos com 300 g e achei %. Nada foi gravado.', peso_ok;
  END IF;
END $$;

COMMIT;

-- Resultado: 'ok' so se os 78 produtos estiverem com o EAN novo e os 5 aromatizadores com 300 g.
SELECT 'ok' AS resultado;
