-- ============================================================================
-- BIO FLORAIS B2B — 29b: PROMOÇÕES REAIS de outubro/26 (B1 a B11)
-- Projeto Neon: bio-florais. Transação única, IDEMPOTENTE, SEM DELETE.
-- Rode DEPOIS do 29a (pode_prosseguir = true). Faz, nesta ordem:
--   a) DESATIVA (active=false, seller_selectable=false) toda promoção que NÃO é desta tabela;
--      ofertas antigas continuam abrindo, só sem aquela promoção (preço B2B normal);
--   b) cria/atualiza B1..B11 (chave = nome), ativas, selecionáveis, sem data de fim;
--   c) liga o alcance (linhas; na B9 também os SKUs exatos) sem remover vínculos;
--   d) grava as 7 elegibilidades exatamente como a tabela (desmarcada = regra inativa);
--   e) termina com UMA linha de conferência por promoção ativa.
-- Nada mais muda: preços, B2C, checkout, frete, cupons, comissão base e janela de 180 dias.
-- ============================================================================
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Trava: cada linha do alcance existe, está ativa/visível e tem produto; a B9 acha seus SKUs.
DO $$
DECLARE
  faltando text;
BEGIN
  SELECT string_agg(l.slug, ', ') INTO faltando
    FROM (VALUES ('adulto'), ('pet'), ('infantil'), ('baby'), ('kids'), ('teen'), ('dose-unica'),
                 ('virtudes-divinas'), ('cosmeticos'), ('cosmeticos-pet'), ('home-care')) AS l(slug)
   WHERE NOT EXISTS (
     SELECT 1 FROM b2b_commercial_groups g
       JOIN b2b_commercial_group_products gp ON gp.commercial_group_id = g.id
       JOIN products p ON p.id = gp.product_id AND p.active
      WHERE g.slug = l.slug AND g.active AND g.b2b_visible);

  IF faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Promoções out/26 abortadas: linha(s) sem grupo ativo/visível ou sem produto: %', faltando;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE active AND slug LIKE 'cosmeticos-sabonete-liquido-%')
     OR NOT EXISTS (SELECT 1 FROM products WHERE active AND slug = 'cosmeticos-pet-higiene-oral-spray-para-halito-menta')
     OR NOT EXISTS (SELECT 1 FROM products WHERE active AND slug LIKE 'home-care-aromatizador-spray-%') THEN
    RAISE EXCEPTION 'Promoções out/26 abortadas: a B9 não achou algum de seus SKUs (sabonetes líquidos, Spray para Hálito Menta ou aromatizadores).';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- A tabela do Luis (uma linha por promoção; NULL = opção desmarcada)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE promo_out26 (
  codigo text PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  mecanica text NOT NULL,          -- texto de conferência
  tipo text NOT NULL,              -- 'abertura_reconquista' | 'recorrente'
  kind text NOT NULL,              -- 'bonus' | 'percentage'
  buy_quantity integer,
  free_quantity integer,
  percentage numeric,
  alcance text NOT NULL,           -- 'florais4' | 'florais4b' | 'cosmeticos3' | 'b9'
  u1 numeric, u2 numeric, u3 numeric,
  d30 numeric, d60 numeric, d90 numeric, d180 numeric
) ON COMMIT DROP;

INSERT INTO promo_out26 VALUES
  ('B1',  'Compre 3 pague 2 · Florais', 'Compre 3 pague 2', 'abertura_reconquista', 'bonus', 2, 1, NULL, 'florais4', 10, 8, 6, 10, 8, 6, 3),
  ('B2',  '10% de desconto · Florais', '10%', 'recorrente', 'percentage', NULL, NULL, 10, 'florais4', 10, 8, 6, 10, 8, 6, 3),
  ('B3',  'Compre 4 pague 2 · Florais', 'Compre 4 pague 2', 'abertura_reconquista', 'bonus', 2, 2, NULL, 'florais4', 6, 4, 2, 6, 4, 2, 1),
  ('B4',  '15% de desconto · Florais', '15%', 'recorrente', 'percentage', NULL, NULL, 15, 'florais4', 7, 5, 3, 7, 5, 3, 1),
  ('B5',  'Compre 3 pague 1 · Florais Kids, Teen, Dose Única e Virtudes', 'Compre 3 pague 1', 'abertura_reconquista', 'bonus', 1, 2, NULL, 'florais4b', 5, 3, NULL, 5, 3, 1, NULL),
  ('B6',  '15% de desconto · Florais Kids, Teen, Dose Única e Virtudes', '15%', 'recorrente', 'percentage', NULL, NULL, 15, 'florais4b', 10, 8, 6, 10, 8, 6, 3),
  ('B7',  'Compre 1 ganhe mais 1 · Florais Kids, Teen, Dose Única e Virtudes', 'Compre 1 ganhe mais 1', 'abertura_reconquista', 'bonus', 1, 1, NULL, 'florais4b', 7, 5, 3, 7, 5, 3, NULL),
  ('B8',  '20% de desconto · Florais Kids, Teen, Dose Única e Virtudes', '20%', 'recorrente', 'percentage', NULL, NULL, 20, 'florais4b', 7, 5, 3, 7, 5, 3, 1),
  ('B9',  'Compre 3 ganhe mais 1 · Sabonetes, Spray para Hálito e Aromatizadores', 'Compre 3 ganhe mais 1', 'abertura_reconquista', 'bonus', 3, 1, NULL, 'b9', 7, 5, 3, 7, 5, 3, NULL),
  ('B10', '8% de desconto · Cosméticos, Cosméticos Pet e Home Care', '8%', 'recorrente', 'percentage', NULL, NULL, 8, 'cosmeticos3', 8, 6, 4, 8, 6, 4, 1),
  ('B11', '10% de desconto · Cosméticos, Cosméticos Pet e Home Care', '10%', 'recorrente', 'percentage', NULL, NULL, 10, 'cosmeticos3', 6, 4, 2, 6, 4, 2, 1);

-- Linhas de cada alcance.
CREATE TEMP TABLE alcance_linhas (alcance text, slug text) ON COMMIT DROP;
INSERT INTO alcance_linhas VALUES
  ('florais4', 'adulto'), ('florais4', 'pet'), ('florais4', 'infantil'), ('florais4', 'baby'),
  ('florais4b', 'kids'), ('florais4b', 'teen'), ('florais4b', 'dose-unica'), ('florais4b', 'virtudes-divinas'),
  ('cosmeticos3', 'cosmeticos'), ('cosmeticos3', 'cosmeticos-pet'), ('cosmeticos3', 'home-care'),
  ('b9', 'cosmeticos'), ('b9', 'cosmeticos-pet'), ('b9', 'home-care');

-- ---------------------------------------------------------------------------
-- a) Desativa tudo que NÃO é da tabela (sem DELETE)
-- ---------------------------------------------------------------------------
UPDATE b2b_promotions
   SET active = false, seller_selectable = false, updated_at = now()
 WHERE name NOT IN (SELECT nome FROM promo_out26)
   AND (active OR seller_selectable);

-- ---------------------------------------------------------------------------
-- b) Cria/atualiza as promoções da tabela
-- ---------------------------------------------------------------------------
UPDATE b2b_promotions p
   SET scope = 'b2b',
       type = CASE t.kind WHEN 'percentage' THEN 'percentage_discount' ELSE 'buy_x_get_y_auto_same_sku' END,
       buy_quantity = t.buy_quantity, free_quantity = t.free_quantity, percentage = t.percentage,
       promo_type = t.tipo, active = true, seller_selectable = true,
       starts_at = NULL, ends_at = NULL, updated_at = now()
  FROM promo_out26 t
 WHERE p.name = t.nome;

INSERT INTO b2b_promotions
  (name, scope, type, commercial_purpose, eligibility_scope, buy_quantity, free_quantity, percentage,
   seller_selectable, active, promo_type)
SELECT t.nome, 'b2b', CASE t.kind WHEN 'percentage' THEN 'percentage_discount' ELSE 'buy_x_get_y_auto_same_sku' END,
       'general', 'none', t.buy_quantity, t.free_quantity, t.percentage, true, true, t.tipo
  FROM promo_out26 t
 WHERE NOT EXISTS (SELECT 1 FROM b2b_promotions p WHERE p.name = t.nome);

-- ---------------------------------------------------------------------------
-- c) Alcance: linhas (todas) e, só na B9, os SKUs exatos
-- ---------------------------------------------------------------------------
INSERT INTO b2b_promotion_commercial_groups (promotion_id, commercial_group_id)
SELECT p.id, g.id
  FROM promo_out26 t
  JOIN b2b_promotions p ON p.name = t.nome
  JOIN alcance_linhas a ON a.alcance = t.alcance
  JOIN b2b_commercial_groups g ON g.slug = a.slug
 WHERE NOT EXISTS (
   SELECT 1 FROM b2b_promotion_commercial_groups x
    WHERE x.promotion_id = p.id AND x.commercial_group_id = g.id);

INSERT INTO b2b_promotion_products (promotion_id, product_id)
SELECT p.id, pr.id
  FROM promo_out26 t
  JOIN b2b_promotions p ON p.name = t.nome
  JOIN products pr ON pr.active AND (
         pr.slug LIKE 'cosmeticos-sabonete-liquido-%'
      OR pr.slug = 'cosmeticos-pet-higiene-oral-spray-para-halito-menta'
      OR pr.slug LIKE 'home-care-aromatizador-spray-%')
 WHERE t.alcance = 'b9'
   AND NOT EXISTS (
     SELECT 1 FROM b2b_promotion_products x WHERE x.promotion_id = p.id AND x.product_id = pr.id);

-- ---------------------------------------------------------------------------
-- d) Elegibilidades: marcadas = comissão extra; desmarcadas = regra inativa
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE opcoes (modo text, max_uses integer, duration_days integer) ON COMMIT DROP;
INSERT INTO opcoes VALUES
  ('uses', 1, NULL), ('uses', 2, NULL), ('uses', 3, NULL),
  ('days', NULL, 30), ('days', NULL, 60), ('days', NULL, 90), ('days', NULL, 180);

CREATE TEMP TABLE elegibilidades ON COMMIT DROP AS
SELECT p.id AS promotion_id, o.modo, o.max_uses, o.duration_days,
       CASE
         WHEN o.modo = 'uses' AND o.max_uses = 1 THEN t.u1
         WHEN o.modo = 'uses' AND o.max_uses = 2 THEN t.u2
         WHEN o.modo = 'uses' AND o.max_uses = 3 THEN t.u3
         WHEN o.duration_days = 30 THEN t.d30
         WHEN o.duration_days = 60 THEN t.d60
         WHEN o.duration_days = 90 THEN t.d90
         ELSE t.d180
       END AS extra
  FROM promo_out26 t
  JOIN b2b_promotions p ON p.name = t.nome
  CROSS JOIN opcoes o;

-- Atualiza a regra geral que já existe (marca ou desmarca)...
UPDATE b2b_commission_rules r
   SET extra_percent = coalesce(e.extra, r.extra_percent), active = (e.extra IS NOT NULL), updated_at = now()
  FROM elegibilidades e
 WHERE r.scope = 'promotion_eligibility' AND r.promotion_id = e.promotion_id
   AND r.responsible_id IS NULL AND r.client_id IS NULL
   AND r.eligibility_mode = e.modo
   AND r.max_uses IS NOT DISTINCT FROM e.max_uses
   AND r.duration_days IS NOT DISTINCT FROM e.duration_days;

-- ...e cria a que ainda não existe (só as marcadas).
INSERT INTO b2b_commission_rules (scope, promotion_id, eligibility_mode, max_uses, duration_days, extra_percent, active)
SELECT 'promotion_eligibility', e.promotion_id, e.modo, e.max_uses, e.duration_days, e.extra, true
  FROM elegibilidades e
 WHERE e.extra IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM b2b_commission_rules r
      WHERE r.scope = 'promotion_eligibility' AND r.promotion_id = e.promotion_id
        AND r.responsible_id IS NULL AND r.client_id IS NULL
        AND r.eligibility_mode = e.modo
        AND r.max_uses IS NOT DISTINCT FROM e.max_uses
        AND r.duration_days IS NOT DISTINCT FROM e.duration_days);

-- ---------------------------------------------------------------------------
-- e) CONFERÊNCIA: uma linha por promoção ativa (compare com a tabela do Luis)
-- ---------------------------------------------------------------------------
SELECT t.codigo, p.name AS promocao, p.promo_type AS tipo, t.mecanica,
       CASE WHEN t.alcance = 'b9'
            THEN (SELECT count(*) FROM b2b_promotion_products x WHERE x.promotion_id = p.id) || ' SKUs em ' ||
                 (SELECT string_agg(g.name, ', ' ORDER BY g.sort_order) FROM b2b_promotion_commercial_groups x
                    JOIN b2b_commercial_groups g ON g.id = x.commercial_group_id WHERE x.promotion_id = p.id)
            ELSE (SELECT string_agg(g.name, ', ' ORDER BY g.sort_order) FROM b2b_promotion_commercial_groups x
                    JOIN b2b_commercial_groups g ON g.id = x.commercial_group_id WHERE x.promotion_id = p.id)
       END AS alcance,
       p.active AS ativa, p.seller_selectable AS selecionavel,
       coalesce((SELECT r.extra_percent::text FROM b2b_commission_rules r WHERE r.scope = 'promotion_eligibility' AND r.promotion_id = p.id AND r.active AND r.responsible_id IS NULL AND r.client_id IS NULL AND r.eligibility_mode = 'uses' AND r.max_uses = 1), '—') AS "1x",
       coalesce((SELECT r.extra_percent::text FROM b2b_commission_rules r WHERE r.scope = 'promotion_eligibility' AND r.promotion_id = p.id AND r.active AND r.responsible_id IS NULL AND r.client_id IS NULL AND r.eligibility_mode = 'uses' AND r.max_uses = 2), '—') AS "2x",
       coalesce((SELECT r.extra_percent::text FROM b2b_commission_rules r WHERE r.scope = 'promotion_eligibility' AND r.promotion_id = p.id AND r.active AND r.responsible_id IS NULL AND r.client_id IS NULL AND r.eligibility_mode = 'uses' AND r.max_uses = 3), '—') AS "3x",
       coalesce((SELECT r.extra_percent::text FROM b2b_commission_rules r WHERE r.scope = 'promotion_eligibility' AND r.promotion_id = p.id AND r.active AND r.responsible_id IS NULL AND r.client_id IS NULL AND r.eligibility_mode = 'days' AND r.duration_days = 30), '—') AS "30d",
       coalesce((SELECT r.extra_percent::text FROM b2b_commission_rules r WHERE r.scope = 'promotion_eligibility' AND r.promotion_id = p.id AND r.active AND r.responsible_id IS NULL AND r.client_id IS NULL AND r.eligibility_mode = 'days' AND r.duration_days = 60), '—') AS "60d",
       coalesce((SELECT r.extra_percent::text FROM b2b_commission_rules r WHERE r.scope = 'promotion_eligibility' AND r.promotion_id = p.id AND r.active AND r.responsible_id IS NULL AND r.client_id IS NULL AND r.eligibility_mode = 'days' AND r.duration_days = 90), '—') AS "90d",
       coalesce((SELECT r.extra_percent::text FROM b2b_commission_rules r WHERE r.scope = 'promotion_eligibility' AND r.promotion_id = p.id AND r.active AND r.responsible_id IS NULL AND r.client_id IS NULL AND r.eligibility_mode = 'days' AND r.duration_days = 180), '—') AS "180d"
  FROM promo_out26 t
  JOIN b2b_promotions p ON p.name = t.nome
 ORDER BY (regexp_replace(t.codigo, '\D', '', 'g'))::int;

COMMIT;
