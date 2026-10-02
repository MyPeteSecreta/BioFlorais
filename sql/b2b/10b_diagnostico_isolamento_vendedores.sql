-- ============================================================================
-- BIO FLORAIS B2B — 10b: diagnóstico de isolamento entre vendedores
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Procura dado que faria um cliente aparecer para o vendedor errado:
--   * cliente com vínculo ATIVO com mais de um vendedor;
--   * cliente ativo sem nenhum vínculo ativo;
--   * oferta cujo vendedor não é o do vínculo ativo do cliente;
--   * pedido B2B cujo vendedor difere do vendedor da oferta.
-- Esperado: tudo vazio (ignorando os testes manuais do Luis, se ligados a mais
-- de um vendedor de propósito).
-- ============================================================================
SELECT json_build_object(
  'cliente_com_mais_de_um_vendedor_ativo', (
    SELECT coalesce(json_agg(json_build_object('client_id', c.id, 'cliente', c.display_name,
             'vendedores', (SELECT json_agg(r2.responsible_id) FROM b2b_client_relationships r2
                             WHERE r2.client_id = c.id AND r2.active AND r2.unlinked_at IS NULL))), '[]'::json)
      FROM b2b_clients c
     WHERE (SELECT count(*) FROM b2b_client_relationships r
             WHERE r.client_id = c.id AND r.active AND r.unlinked_at IS NULL) > 1
  ),
  'cliente_ativo_sem_vinculo', (
    SELECT coalesce(json_agg(json_build_object('client_id', c.id, 'cliente', c.display_name)), '[]'::json)
      FROM b2b_clients c
     WHERE c.active AND NOT EXISTS (SELECT 1 FROM b2b_client_relationships r
                                     WHERE r.client_id = c.id AND r.active AND r.unlinked_at IS NULL)
  ),
  'oferta_de_vendedor_diferente_do_vinculo', (
    SELECT coalesce(json_agg(json_build_object('offer_id', o.id, 'oferta_vendedor', o.responsible_id,
             'cliente', c.display_name)), '[]'::json)
      FROM b2b_offers o JOIN b2b_clients c ON c.id = o.client_id
     WHERE NOT EXISTS (SELECT 1 FROM b2b_client_relationships r
                        WHERE r.client_id = o.client_id AND r.responsible_id = o.responsible_id
                          AND r.active AND r.unlinked_at IS NULL)
  ),
  'pedido_b2b_com_vendedor_diferente_da_oferta', (
    SELECT coalesce(json_agg(json_build_object('order_id', ord.id, 'pedido_vendedor', ord.b2b_responsible_id,
             'oferta_vendedor', o.responsible_id)), '[]'::json)
      FROM orders ord JOIN b2b_offers o ON o.id = ord.b2b_offer_id
     WHERE ord.b2b_responsible_id IS DISTINCT FROM o.responsible_id
  ),
  'vendedores', (
    SELECT coalesce(json_agg(json_build_object('id', id, 'name', name, 'status', status)), '[]'::json)
      FROM b2b_responsibles
  )
) AS diagnostico_isolamento;
