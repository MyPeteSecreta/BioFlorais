-- ============================================================================
-- BIO FLORAIS B2B — PREFLIGHT EM CONSULTA ÚNICA (somente leitura)
-- ============================================================================
-- UM único SELECT que devolve UMA linha com UMA coluna json ("preflight")
-- contendo os blocos [1]..[12] de 01_preflight_readonly.sql. Não escreve
-- nada (sem DDL/DML). Para garantia extra, rode dentro de
-- "BEGIN TRANSACTION READ ONLY; ... ROLLBACK;" se o console permitir.
--
-- O bloco [12] usa to_jsonb(o)->>'b2b_offer_id', então NÃO falha se a
-- coluna ainda não existir (volta lista vazia; o bloco [3] mostra
-- FALTANDO). Os blocos [7]..[9] leem tabelas b2b_* que a coleta de 25/09
-- confirmou existirem; se alguma não existir, a consulta inteira falha
-- e o bloco [2] de 01_preflight_readonly.sql indica qual.
-- ============================================================================

SELECT json_build_object(

  'generated_at', now(),

  -- [1] Tabelas relevantes existentes e nº de colunas.
  'b1_tables', (
    SELECT coalesce(json_agg(json_build_object(
             'table_name', t.table_name,
             'column_count', (SELECT count(*) FROM information_schema.columns c
                               WHERE c.table_schema = 'public' AND c.table_name = t.table_name)
           ) ORDER BY t.table_name), '[]'::json)
      FROM information_schema.tables t
     WHERE t.table_schema = 'public'
       AND (t.table_name LIKE 'b2b\_%' ESCAPE '\'
            OR t.table_name IN ('orders', 'order_items', 'coupons', 'coupon_redemptions',
                                'payments', 'products', 'customers', 'addresses'))
  ),

  -- [2] Tabelas usadas pelo código B2B que NÃO existem.
  'b2_missing_tables', (
    SELECT coalesce(json_agg(e.table_name ORDER BY e.table_name), '[]'::json)
      FROM (VALUES
        ('b2b_commercial_groups'), ('b2b_commercial_group_products'),
        ('b2b_responsible_invites'), ('b2b_responsibles'), ('b2b_clients'),
        ('b2b_client_relationships'), ('b2b_promotions'), ('b2b_promotion_terms'),
        ('b2b_promotion_commercial_groups'), ('b2b_promotion_products'),
        ('b2b_offers'), ('b2b_offer_commercial_groups'), ('b2b_offer_promotions'),
        ('b2b_offer_links'), ('b2b_boleto_requests')
      ) AS e(table_name)
     WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables t
                        WHERE t.table_schema = 'public' AND t.table_name = e.table_name)
  ),

  -- [3] Colunas comerciais usadas pelo B2B (ok / FALTANDO).
  'b3_commercial_columns', (
    SELECT json_agg(json_build_object(
             'table_name', e.table_name,
             'column_name', e.column_name,
             'data_type', c.data_type,
             'udt_name', c.udt_name,
             'is_nullable', c.is_nullable,
             'column_default', c.column_default,
             'status', CASE WHEN c.column_name IS NULL THEN 'FALTANDO' ELSE 'ok' END
           ) ORDER BY e.table_name, e.column_name)
      FROM (VALUES
        ('orders', 'b2b_client_id'), ('orders', 'b2b_offer_id'),
        ('orders', 'b2b_responsible_id'), ('orders', 'b2b_responsible_type'),
        ('orders', 'b2b_responsible_name'), ('orders', 'payment_method'),
        ('orders', 'payment_method_discount_cents'),
        ('coupons', 'scope'), ('coupons', 'discounts_shipping'),
        ('b2b_boleto_requests', 'installments'),
        ('b2b_boleto_requests', 'installment_amount_cents'),
        ('b2b_boleto_requests', 'last_installment_amount_cents')
      ) AS e(table_name, column_name)
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = e.table_name
       AND c.column_name = e.column_name
  ),

  -- [4] Todas as colunas das tabelas b2b_* + orders / coupons / payments.
  'b4_columns', (
    SELECT coalesce(json_agg(json_build_object(
             'table_name', c.table_name,
             'ordinal', c.ordinal_position,
             'column_name', c.column_name,
             'data_type', c.data_type,
             'udt_name', c.udt_name,
             'is_nullable', c.is_nullable,
             'column_default', c.column_default
           ) ORDER BY c.table_name, c.ordinal_position), '[]'::json)
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND (c.table_name LIKE 'b2b\_%' ESCAPE '\'
            OR c.table_name IN ('orders', 'coupons', 'payments'))
  ),

  -- [5] Índices.
  'b5_indexes', (
    SELECT coalesce(json_agg(json_build_object(
             'table_name', i.tablename,
             'index_name', i.indexname,
             'definition', i.indexdef
           ) ORDER BY i.tablename, i.indexname), '[]'::json)
      FROM pg_indexes i
     WHERE i.schemaname = 'public'
       AND (i.tablename LIKE 'b2b\_%' ESCAPE '\'
            OR i.tablename IN ('orders', 'coupons', 'payments'))
  ),

  -- [6] Constraints (PK, FK, UNIQUE, CHECK).
  'b6_constraints', (
    SELECT coalesce(json_agg(json_build_object(
             'table_name', rel.relname,
             'constraint_name', con.conname,
             'type', con.contype,
             'validated', con.convalidated,
             'definition', pg_get_constraintdef(con.oid)
           ) ORDER BY rel.relname, con.conname), '[]'::json)
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE ns.nspname = 'public'
       AND (rel.relname LIKE 'b2b\_%' ESCAPE '\'
            OR rel.relname IN ('orders', 'coupons', 'payments'))
  ),

  -- [7] Responsáveis: status e formato do hash (sem expor o hash).
  'b7_responsibles', (
    SELECT coalesce(json_agg(r ORDER BY r.status), '[]'::json)
      FROM (
        SELECT status,
               count(*) AS total,
               count(*) FILTER (WHERE login IS NOT NULL) AS with_login,
               count(*) FILTER (WHERE password_hash LIKE 'scrypt$%$%') AS scrypt_hash,
               count(*) FILTER (WHERE password_hash IS NOT NULL
                                  AND password_hash NOT LIKE 'scrypt$%$%') AS other_hash_format
          FROM b2b_responsibles
         GROUP BY status
      ) r
  ),

  -- [8] Volumes: ofertas, links, grupos, promoções.
  'b8_volumes', json_build_object(
    'offers', (
      SELECT coalesce(json_agg(x ORDER BY x.status), '[]'::json)
        FROM (SELECT status, count(*) AS total,
                     count(*) FILTER (WHERE activated_at IS NULL) AS without_activated_at,
                     count(*) FILTER (WHERE revoked_at IS NOT NULL) AS revoked
                FROM b2b_offers GROUP BY status) x
    ),
    'offer_links', (
      SELECT json_build_object(
               'active', count(*) FILTER (WHERE revoked_at IS NULL),
               'revoked', count(*) FILTER (WHERE revoked_at IS NOT NULL))
        FROM b2b_offer_links
    ),
    'commercial_groups', (
      SELECT json_build_object(
               'visible_b2b', count(*) FILTER (WHERE active AND b2b_visible),
               'hidden', count(*) FILTER (WHERE NOT (active AND b2b_visible)))
        FROM b2b_commercial_groups
    ),
    'promotions_by_type', (
      SELECT coalesce(json_object_agg(type, total), '{}'::json)
        FROM (SELECT type, count(*) AS total FROM b2b_promotions GROUP BY type) x
    )
  ),

  -- [9] Grupos comerciais e produtos sem peso/dimensão.
  'b9_groups_products', (
    SELECT coalesce(json_agg(x ORDER BY x.slug), '[]'::json)
      FROM (
        SELECT g.slug, g.name, g.active, g.b2b_visible,
               count(p.id) AS products,
               count(p.id) FILTER (WHERE p.active) AS active_products,
               count(p.id) FILTER (WHERE p.weight_grams IS NULL OR p.length_cm IS NULL
                                     OR p.width_cm IS NULL OR p.height_cm IS NULL) AS missing_dimensions
          FROM b2b_commercial_groups g
          LEFT JOIN b2b_commercial_group_products gp ON gp.commercial_group_id = g.id
          LEFT JOIN products p ON p.id = gp.product_id
         GROUP BY g.slug, g.name, g.active, g.b2b_visible
      ) x
  ),

  -- [10] Categorias de produto ativas (regra floral R$ 19,90).
  'b10_categories', (
    SELECT coalesce(json_agg(x ORDER BY x.category), '[]'::json)
      FROM (
        SELECT category, count(*) AS products,
               min(price_cents) AS min_b2c_cents,
               max(price_cents) AS max_b2c_cents
          FROM products
         WHERE active
         GROUP BY category
      ) x
  ),

  -- [11] Boletos duplicados por pedido em payments (esperado: []).
  'b11_duplicate_boleto_payments', (
    SELECT coalesce(json_agg(x), '[]'::json)
      FROM (
        SELECT order_id, count(*) AS boleto_payments
          FROM payments
         WHERE method = 'boleto'
         GROUP BY order_id
        HAVING count(*) > 1
      ) x
  ),

  -- [12] Pedidos já vinculados a B2B, por status (tolerante à coluna ausente).
  'b12_b2b_orders_by_status', (
    SELECT coalesce(json_object_agg(status, total), '{}'::json)
      FROM (
        SELECT o.status, count(*) AS total
          FROM orders o
         WHERE to_jsonb(o) ->> 'b2b_offer_id' IS NOT NULL
         GROUP BY o.status
      ) x
  )

) AS preflight;
