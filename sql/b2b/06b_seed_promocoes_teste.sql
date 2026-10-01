-- ============================================================================
-- BIO FLORAIS B2B — SEED DE PROMOÇÕES DE TESTE (pedido do Luis, 01/10)
-- ============================================================================
-- Transação única e IDEMPOTENTE: rodar de novo não duplica nada (tudo é
-- "insere se não existir"). Revisar 06a_..._preflight_one_shot.sql antes.
-- O Luis revisa os valores depois; o admin (aba Promoções) edita.
--
-- Cria/garante:
--  1. b2b_commission_rules (se não existir) + colunas de elegibilidade.
--  2. Grupos comerciais reais a partir das linhas da Home B2C:
--     Adulto, Pet, Infantil, Baby (produtos por products.line_slug).
--  3. "BIO-B2B TEST GROUP" fica INATIVO (não é apagado).
--  4. Promoções (tipo com efeito no servidor: buy_x_get_y_auto_same_sku):
--       "3 por 2" = compra 2, leva +1 grátis (mesmo SKU)
--       "4 por 2" = compra 2, leva +2 grátis (mesmo SKU)
--     nas linhas Adulto, Pet e Infantil (por linha) e, na linha Baby,
--     SOMENTE no produto Sono (promoção pontual por SKU).
--  5. Comissão:
--       base 10% (responsible_base)
--       preço B2B normal +15% (normal_price)
--       3 por 2: 1/2/3 compras +10/+8/+6%; 30/60/90/180 dias +10/+8/+6/+3%
--       4 por 2: 1/2/3 compras +6/+4/+2%;  30/60/90/180 dias +6/+4/+2/+1%
--
-- Sem DROP, sem DELETE. Único UPDATE: desativar o grupo de teste.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- 1. Regras de comissão (estrutura da My Pet, Especificação V1.27/V1.28)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS b2b_commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  responsible_id uuid REFERENCES b2b_responsibles (id),
  client_id uuid REFERENCES b2b_clients (id),
  commercial_group_id uuid REFERENCES b2b_commercial_groups (id),
  product_id uuid REFERENCES products (id),
  promotion_id uuid REFERENCES b2b_promotions (id),
  eligibility_mode text,
  max_uses integer,
  duration_days integer,
  base_percent numeric(10, 4),
  extra_percent numeric(10, 4),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE b2b_commission_rules ADD COLUMN IF NOT EXISTS eligibility_mode text;
ALTER TABLE b2b_commission_rules ADD COLUMN IF NOT EXISTS max_uses integer;
ALTER TABLE b2b_commission_rules ADD COLUMN IF NOT EXISTS duration_days integer;

-- ---------------------------------------------------------------------------
-- Trava de segurança: o produto Sono da linha Baby precisa ser único.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM products WHERE slug = 'baby-floral-em-gotas-sono') <> 1 THEN
    RAISE EXCEPTION 'Seed abortado: esperado exatamente 1 produto baby-floral-em-gotas-sono.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Grupos comerciais reais (linhas da Home B2C)
-- ---------------------------------------------------------------------------
INSERT INTO b2b_commercial_groups (slug, name, active, b2c_visible, b2b_visible, sort_order)
SELECT v.slug, v.name, true, true, true, v.sort_order
  FROM (VALUES
    ('adulto', 'Adulto', 10),
    ('pet', 'Pet', 20),
    ('infantil', 'Infantil', 30),
    ('baby', 'Baby', 40)
  ) AS v(slug, name, sort_order)
 WHERE NOT EXISTS (SELECT 1 FROM b2b_commercial_groups g WHERE g.slug = v.slug);

INSERT INTO b2b_commercial_group_products (commercial_group_id, product_id)
SELECT g.id, p.id
  FROM b2b_commercial_groups g
  JOIN products p ON p.line_slug = g.slug AND p.active
 WHERE g.slug IN ('adulto', 'pet', 'infantil', 'baby')
   AND NOT EXISTS (
     SELECT 1 FROM b2b_commercial_group_products gp
      WHERE gp.commercial_group_id = g.id AND gp.product_id = p.id
   );

-- ---------------------------------------------------------------------------
-- 3. Grupo de teste antigo fica inativo
-- ---------------------------------------------------------------------------
UPDATE b2b_commercial_groups
   SET active = false, updated_at = now()
 WHERE upper(trim(name)) = 'BIO-B2B TEST GROUP'
   AND active;

-- ---------------------------------------------------------------------------
-- 4. Promoções
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE seed_promotions (
  name text PRIMARY KEY,
  kind text NOT NULL,          -- '3por2' | '4por2'
  line_slug text NOT NULL,
  product_slug text,           -- preenchido = promoção pontual por SKU
  buy_quantity integer NOT NULL,
  free_quantity integer NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_promotions VALUES
  ('3 por 2 - Adulto',    '3por2', 'adulto',   NULL, 2, 1),
  ('4 por 2 - Adulto',    '4por2', 'adulto',   NULL, 2, 2),
  ('3 por 2 - Pet',       '3por2', 'pet',      NULL, 2, 1),
  ('4 por 2 - Pet',       '4por2', 'pet',      NULL, 2, 2),
  ('3 por 2 - Infantil',  '3por2', 'infantil', NULL, 2, 1),
  ('4 por 2 - Infantil',  '4por2', 'infantil', NULL, 2, 2),
  ('3 por 2 - Baby Sono', '3por2', 'baby', 'baby-floral-em-gotas-sono', 2, 1),
  ('4 por 2 - Baby Sono', '4por2', 'baby', 'baby-floral-em-gotas-sono', 2, 2);

INSERT INTO b2b_promotions
  (name, scope, type, commercial_purpose, eligibility_scope,
   buy_quantity, free_quantity, seller_selectable, active)
SELECT s.name, 'b2b', 'buy_x_get_y_auto_same_sku', 'general', 'none',
       s.buy_quantity, s.free_quantity, true, true
  FROM seed_promotions s
 WHERE NOT EXISTS (SELECT 1 FROM b2b_promotions p WHERE p.name = s.name);

-- Vínculo com a linha (todas, inclusive Baby, para o Offer Builder saber
-- em qual card a promoção aparece).
INSERT INTO b2b_promotion_commercial_groups (promotion_id, commercial_group_id)
SELECT p.id, g.id
  FROM seed_promotions s
  JOIN b2b_promotions p ON p.name = s.name
  JOIN b2b_commercial_groups g ON g.slug = s.line_slug
 WHERE NOT EXISTS (
   SELECT 1 FROM b2b_promotion_commercial_groups pg
    WHERE pg.promotion_id = p.id AND pg.commercial_group_id = g.id
 );

-- Baby: restrita ao produto Sono (produto explícito tem prioridade sobre
-- a linha no motor de promoção).
INSERT INTO b2b_promotion_products (promotion_id, product_id)
SELECT p.id, product.id
  FROM seed_promotions s
  JOIN b2b_promotions p ON p.name = s.name
  JOIN products product ON product.slug = s.product_slug
 WHERE s.product_slug IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM b2b_promotion_products pp
      WHERE pp.promotion_id = p.id AND pp.product_id = product.id
   );

-- ---------------------------------------------------------------------------
-- 5. Comissões (regras gerais: sem responsável/cliente específico)
-- ---------------------------------------------------------------------------
INSERT INTO b2b_commission_rules (scope, base_percent, active)
SELECT 'responsible_base', 10, true
 WHERE NOT EXISTS (
   SELECT 1 FROM b2b_commission_rules
    WHERE scope = 'responsible_base' AND responsible_id IS NULL AND client_id IS NULL
 );

INSERT INTO b2b_commission_rules (scope, extra_percent, active)
SELECT 'normal_price', 15, true
 WHERE NOT EXISTS (
   SELECT 1 FROM b2b_commission_rules
    WHERE scope = 'normal_price' AND responsible_id IS NULL AND client_id IS NULL
 );

INSERT INTO b2b_commission_rules
  (scope, promotion_id, eligibility_mode, max_uses, duration_days, extra_percent, active)
SELECT 'promotion_eligibility', p.id, m.eligibility_mode, m.max_uses, m.duration_days, m.extra_percent, true
  FROM seed_promotions s
  JOIN b2b_promotions p ON p.name = s.name
  JOIN (VALUES
    ('3por2', 'uses', 1,    NULL, 10),
    ('3por2', 'uses', 2,    NULL, 8),
    ('3por2', 'uses', 3,    NULL, 6),
    ('3por2', 'days', NULL, 30,   10),
    ('3por2', 'days', NULL, 60,   8),
    ('3por2', 'days', NULL, 90,   6),
    ('3por2', 'days', NULL, 180,  3),
    ('4por2', 'uses', 1,    NULL, 6),
    ('4por2', 'uses', 2,    NULL, 4),
    ('4por2', 'uses', 3,    NULL, 2),
    ('4por2', 'days', NULL, 30,   6),
    ('4por2', 'days', NULL, 60,   4),
    ('4por2', 'days', NULL, 90,   2),
    ('4por2', 'days', NULL, 180,  1)
  ) AS m(kind, eligibility_mode, max_uses, duration_days, extra_percent)
    ON m.kind = s.kind
 WHERE NOT EXISTS (
   SELECT 1 FROM b2b_commission_rules r
    WHERE r.scope = 'promotion_eligibility'
      AND r.promotion_id = p.id
      AND r.eligibility_mode = m.eligibility_mode
      AND r.max_uses IS NOT DISTINCT FROM m.max_uses
      AND r.duration_days IS NOT DISTINCT FROM m.duration_days
 );

COMMIT;

-- ---------------------------------------------------------------------------
-- Conferência (somente leitura), depois do COMMIT:
-- ---------------------------------------------------------------------------
-- SELECT p.name, p.buy_quantity, p.free_quantity, g.name AS linha,
--        (SELECT string_agg(pr.slug, ', ') FROM b2b_promotion_products pp
--           JOIN products pr ON pr.id = pp.product_id WHERE pp.promotion_id = p.id) AS so_produtos,
--        (SELECT count(*) FROM b2b_commission_rules r WHERE r.promotion_id = p.id) AS regras
--   FROM b2b_promotions p
--   JOIN b2b_promotion_commercial_groups pg ON pg.promotion_id = p.id
--   JOIN b2b_commercial_groups g ON g.id = pg.commercial_group_id
--  WHERE p.name LIKE '_ por 2 - %'
--  ORDER BY g.sort_order, p.name;
-- Esperado: 8 promoções, 7 regras cada; Baby com so_produtos = baby-floral-em-gotas-sono.
