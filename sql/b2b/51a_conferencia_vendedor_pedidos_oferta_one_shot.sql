-- ============================================================================
-- BIO FLORAIS — 51a: CONFERÊNCIA do vendedor dos pedidos de oferta (pedidos com b2b_offer_id). Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma linha JSON. Não altera nada.
-- Pergunta: todo pedido cuja oferta tem responsible_id (inclusive os da loja geral /parceiros, origin = 'parceiros') está com o
-- vendedor ESPERADO (o responsável da oferta) no pedido, e portanto aparece com o nome certo no admin/Central (Omie) e entra na
-- comissão?
-- Como o site rotula (código): admin do pedido = orders.b2b_responsible_name (sem nome: "Bio Florais"); Central/Omie =
-- coalesce(nome do vendedor do PEDIDO, orders.b2b_responsible_name) e "nome no Omie" = omie_vendor_code (ou o nome do cadastro);
-- comissões = pedidos com b2b_offer_id, vendedor = orders.b2b_responsible_id, percentuais por item (order_items.commission_*).
-- Diagnóstico por pedido:
--   ok                  vendedor do pedido = responsável da oferta
--   sem_vendedor        pedido sem b2b_responsible_id (aparece sem vendedor / "venda direta" e sai da comissão do vendedor)
--   vendedor_diferente  pedido com outro vendedor que não o da oferta
--   oferta_sem_vendedor a oferta não tem responsible_id (nada a comparar)
-- ============================================================================
WITH base AS (
  SELECT o.id,
         to_char(o.created_at, 'YYYY-MM-DD HH24:MI') AS criado_em,
         o.status,
         to_jsonb(o) ->> 'origin' AS origem,
         to_jsonb(o) ->> 'origin_code' AS codigo_origem,
         of.id AS oferta_id,
         COALESCE((to_jsonb(of) ->> 'is_storefront')::boolean, false) AS oferta_vitrine,
         of.responsible_id AS vendedor_esperado_id,
         re.name AS vendedor_esperado,
         o.b2b_responsible_id AS vendedor_pedido_id,
         o.b2b_responsible_name AS nome_gravado_no_pedido,
         rp.name AS vendedor_pedido_cadastro,
         -- rótulo do admin (pedido): nome gravado no pedido ou "Bio Florais"
         COALESCE(NULLIF(btrim(o.b2b_responsible_name), ''), 'Bio Florais') AS rotulo_admin,
         -- rótulo da Central/Omie: vendedor do pedido (nome do cadastro ou o gravado) e "nome no Omie" efetivo
         COALESCE(NULLIF(btrim(COALESCE(rp.name, o.b2b_responsible_name)), ''), '(sem vendedor)') AS rotulo_central,
         COALESCE(NULLIF(btrim(to_jsonb(rp) ->> 'omie_vendor_code'), ''), NULLIF(btrim(rp.name), ''), '(sem vendedor)') AS nome_no_omie,
         (SELECT count(*) FROM order_items i WHERE i.order_id = o.id AND i.unit_price_cents > 0) AS itens_pagos,
         (SELECT count(*) FROM order_items i WHERE i.order_id = o.id AND i.unit_price_cents > 0 AND i.commission_total_percent IS NOT NULL) AS itens_com_comissao
    FROM orders o
    JOIN b2b_offers of ON of.id = o.b2b_offer_id
    LEFT JOIN b2b_responsibles re ON re.id = of.responsible_id
    LEFT JOIN b2b_responsibles rp ON rp.id = o.b2b_responsible_id
   WHERE o.b2b_offer_id IS NOT NULL
), diag AS (
  SELECT b.*,
         CASE WHEN b.vendedor_esperado_id IS NULL THEN 'oferta_sem_vendedor'
              WHEN b.vendedor_pedido_id IS NULL THEN 'sem_vendedor'
              WHEN b.vendedor_pedido_id <> b.vendedor_esperado_id THEN 'vendedor_diferente'
              ELSE 'ok' END AS diagnostico,
         CASE WHEN b.itens_pagos = 0 THEN 'sem itens pagos'
              WHEN b.itens_com_comissao = 0 THEN 'sem comissão (nenhum item com percentual)'
              WHEN b.itens_com_comissao < b.itens_pagos THEN 'comissão parcial'
              ELSE 'com comissão' END AS comissao
    FROM base b
)
SELECT json_build_object(
  'colunas_necessarias_existem', (SELECT count(*) FROM information_schema.columns
      WHERE (table_name, column_name) IN (('orders', 'b2b_offer_id'), ('orders', 'b2b_responsible_id'), ('orders', 'b2b_responsible_name'),
                                          ('b2b_offers', 'responsible_id'), ('order_items', 'commission_total_percent'))) = 5,
  'pedidos_de_oferta', (SELECT count(*) FROM diag),
  'por_diagnostico', (SELECT COALESCE(json_object_agg(diagnostico, n), '{}'::json) FROM (SELECT diagnostico, count(*) AS n FROM diag GROUP BY diagnostico) t),
  'por_origem_e_diagnostico', (SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.origem, t.diagnostico), '[]'::json)
      FROM (SELECT COALESCE(origem, '(link do cliente)') AS origem, diagnostico, count(*) AS pedidos FROM diag GROUP BY 1, 2) t),
  'divergentes_sem_comissao_ou_sem_vendedor', (SELECT count(*) FROM diag WHERE diagnostico IN ('sem_vendedor', 'vendedor_diferente') OR comissao LIKE 'sem comissão%'),
  'amostra_divergentes', (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
      SELECT left(id::text, 8) AS pedido, criado_em, status, origem, codigo_origem, oferta_vitrine,
             vendedor_esperado, nome_gravado_no_pedido, rotulo_admin, rotulo_central, nome_no_omie, diagnostico, comissao
        FROM diag
       WHERE diagnostico IN ('sem_vendedor', 'vendedor_diferente') OR comissao LIKE 'sem comissão%'
       ORDER BY criado_em DESC LIMIT 100) t),
  'pode_prosseguir', to_regclass('public.orders') IS NOT NULL AND to_regclass('public.b2b_offers') IS NOT NULL
) AS conferencia_vendedor_pedidos_oferta;
