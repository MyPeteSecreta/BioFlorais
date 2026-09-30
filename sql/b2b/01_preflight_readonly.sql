-- ============================================================================
-- BIO FLORAIS B2B — PREFLIGHT SOMENTE LEITURA (candidata b2b/bio-limpa-v1)
-- ============================================================================
-- Rodar no Neon da Bio ANTES de qualquer SQL candidato. Não altera nada:
-- tudo roda dentro de uma transação READ ONLY encerrada com ROLLBACK.
-- Se um bloco falhar, o Postgres aborta o restante da transação: nesse
-- caso rode os blocos seguintes um a um (cada SELECT é independente).
-- O bloco [12] fica por último de propósito (depende de coluna que pode
-- não existir). Enviar o resultado de TODOS os blocos para revisão.
-- ============================================================================

BEGIN TRANSACTION READ ONLY;

-- [1] Quais tabelas relevantes existem.
SELECT t.table_name,
       (SELECT count(*) FROM information_schema.columns c
         WHERE c.table_schema = 'public' AND c.table_name = t.table_name) AS column_count
  FROM information_schema.tables t
 WHERE t.table_schema = 'public'
   AND (t.table_name LIKE 'b2b\_%' ESCAPE '\'
        OR t.table_name IN ('orders', 'order_items', 'coupons', 'coupon_redemptions',
                            'payments', 'products', 'customers', 'addresses'))
 ORDER BY t.table_name;

-- [2] Tabelas que o código B2B usa e que NÃO existem (esperado: vazio,
--     exceto talvez b2b_boleto_requests).
SELECT expected.table_name AS missing_table
  FROM (VALUES
    ('b2b_commercial_groups'), ('b2b_commercial_group_products'),
    ('b2b_responsible_invites'), ('b2b_responsibles'), ('b2b_clients'),
    ('b2b_client_relationships'), ('b2b_promotions'), ('b2b_promotion_terms'),
    ('b2b_promotion_commercial_groups'), ('b2b_promotion_products'),
    ('b2b_offers'), ('b2b_offer_commercial_groups'), ('b2b_offer_promotions'),
    ('b2b_offer_links'), ('b2b_boleto_requests')
  ) AS expected(table_name)
  LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public' AND t.table_name = expected.table_name
 WHERE t.table_name IS NULL
 ORDER BY 1;

-- [3] Colunas comerciais usadas pelo código B2B: presença, tipo,
--     nulabilidade e default.
SELECT expected.table_name,
       expected.column_name,
       c.data_type,
       c.udt_name,
       c.is_nullable,
       c.column_default,
       CASE WHEN c.column_name IS NULL THEN 'FALTANDO' ELSE 'ok' END AS status
  FROM (VALUES
    ('orders', 'b2b_client_id'),
    ('orders', 'b2b_offer_id'),
    ('orders', 'b2b_responsible_id'),
    ('orders', 'b2b_responsible_type'),
    ('orders', 'b2b_responsible_name'),
    ('orders', 'payment_method'),
    ('orders', 'payment_method_discount_cents'),
    ('coupons', 'scope'),
    ('coupons', 'discounts_shipping'),
    ('b2b_boleto_requests', 'installments'),
    ('b2b_boleto_requests', 'installment_amount_cents'),
    ('b2b_boleto_requests', 'last_installment_amount_cents')
  ) AS expected(table_name, column_name)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = expected.table_name
   AND c.column_name = expected.column_name
 ORDER BY expected.table_name, expected.column_name;

-- [4] Todas as colunas das tabelas B2B + orders / coupons / payments.
SELECT c.table_name,
       c.ordinal_position,
       c.column_name,
       c.data_type,
       c.udt_name,
       c.is_nullable,
       c.column_default
  FROM information_schema.columns c
 WHERE c.table_schema = 'public'
   AND (c.table_name LIKE 'b2b\_%' ESCAPE '\'
        OR c.table_name IN ('orders', 'coupons', 'payments'))
 ORDER BY c.table_name, c.ordinal_position;

-- [5] Índices (inclui únicos/parciais) das mesmas tabelas.
SELECT i.tablename, i.indexname, i.indexdef
  FROM pg_indexes i
 WHERE i.schemaname = 'public'
   AND (i.tablename LIKE 'b2b\_%' ESCAPE '\'
        OR i.tablename IN ('orders', 'coupons', 'payments'))
 ORDER BY i.tablename, i.indexname;

-- [6] Constraints (PK, FK, UNIQUE, CHECK) das mesmas tabelas.
SELECT rel.relname AS table_name,
       con.conname AS constraint_name,
       con.contype AS type,
       con.convalidated AS validated,
       pg_get_constraintdef(con.oid) AS definition
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
 WHERE ns.nspname = 'public'
   AND (rel.relname LIKE 'b2b\_%' ESCAPE '\'
        OR rel.relname IN ('orders', 'coupons', 'payments'))
 ORDER BY rel.relname, con.conname;

-- [7] Responsáveis: status e formato do hash de senha (sem expor o hash).
SELECT status,
       count(*) AS total,
       count(*) FILTER (WHERE login IS NOT NULL) AS with_login,
       count(*) FILTER (WHERE password_hash LIKE 'scrypt$%$%') AS scrypt_hash,
       count(*) FILTER (WHERE password_hash IS NOT NULL
                          AND password_hash NOT LIKE 'scrypt$%$%') AS other_hash_format
  FROM b2b_responsibles
 GROUP BY status
 ORDER BY status;

-- [8] Volumes: ofertas, links, grupos, promoções.
SELECT 'b2b_offers' AS item, status AS detail, count(*) AS total,
       count(*) FILTER (WHERE activated_at IS NULL) AS without_activated_at,
       count(*) FILTER (WHERE revoked_at IS NOT NULL) AS revoked
  FROM b2b_offers GROUP BY status
UNION ALL
SELECT 'b2b_offer_links',
       CASE WHEN revoked_at IS NULL THEN 'ativos' ELSE 'revogados' END,
       count(*), NULL, NULL
  FROM b2b_offer_links GROUP BY 2
UNION ALL
SELECT 'b2b_commercial_groups',
       CASE WHEN active AND b2b_visible THEN 'visiveis_b2b' ELSE 'ocultos' END,
       count(*), NULL, NULL
  FROM b2b_commercial_groups GROUP BY 2
UNION ALL
SELECT 'b2b_promotions', type, count(*), NULL, NULL
  FROM b2b_promotions GROUP BY type
ORDER BY 1, 2;

-- [9] Grupos comerciais e produtos sem peso/dimensão (o frete falha
--     para esses produtos).
SELECT g.slug, g.name, g.active, g.b2b_visible,
       count(p.id) AS products,
       count(p.id) FILTER (WHERE p.active) AS active_products,
       count(p.id) FILTER (WHERE p.weight_grams IS NULL OR p.length_cm IS NULL
                             OR p.width_cm IS NULL OR p.height_cm IS NULL) AS missing_dimensions
  FROM b2b_commercial_groups g
  LEFT JOIN b2b_commercial_group_products gp ON gp.commercial_group_id = g.id
  LEFT JOIN products p ON p.id = gp.product_id
 GROUP BY g.slug, g.name, g.active, g.b2b_visible
 ORDER BY g.slug;

-- [10] Categorias de produto ativas (confere a regra "floral = R$ 19,90":
--      Floral em gotas, Floral dose única, Floral de Ambiente, Snack Floral,
--      Virtudes Divinas; demais = 55% do preço B2C).
SELECT category, count(*) AS products,
       min(price_cents) AS min_b2c_cents,
       max(price_cents) AS max_b2c_cents
  FROM products
 WHERE active
 GROUP BY category
 ORDER BY category;

-- [11] Pagamentos de boleto duplicados por pedido (impediriam o índice
--      único parcial do SQL candidato; esperado: vazio).
SELECT order_id, count(*) AS boleto_payments
  FROM payments
 WHERE method = 'boleto'
 GROUP BY order_id
HAVING count(*) > 1;

-- [12] Pedidos já vinculados a B2B (falha se orders.b2b_offer_id não
--      existir — nesse caso o bloco [3] já terá mostrado FALTANDO).
SELECT status, count(*) AS total
  FROM orders
 WHERE b2b_offer_id IS NOT NULL
 GROUP BY status;

ROLLBACK;
