-- ============================================================================
-- BIO FLORAIS B2B — 33a: preflight da promoção por LINHA (a mesma promoção em várias linhas da oferta)
-- Projeto Neon: bio-florais. SOMENTE LEITURA, uma consulta, uma linha JSON.
-- Mostra a(s) restrição(ões) únicas/PK atuais de b2b_offer_promotions (hoje impedem a mesma promoção em
-- duas linhas da mesma oferta), se o índice novo já existe, e quantas linhas antigas ficaram sem linha.
-- ============================================================================
SELECT json_build_object(
  'tabela_existe', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'b2b_offer_promotions'),
  'restricoes_atuais', (
    SELECT coalesce(json_agg(json_build_object('nome', c.conname, 'tipo', c.contype, 'definicao', pg_get_constraintdef(c.oid))), '[]'::json)
      FROM pg_constraint c
     WHERE c.conrelid = 'b2b_offer_promotions'::regclass AND c.contype IN ('p', 'u')),
  'indice_novo_existe', EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'b2b_offer_promotions_offer_promo_group_uq'),
  'linhas_total', (SELECT count(*) FROM b2b_offer_promotions),
  'linhas_sem_linha_gravada', (SELECT count(*) FROM b2b_offer_promotions WHERE commercial_group_id IS NULL),
  'duplicadas_oferta_promocao_linha', (
    SELECT count(*) FROM (
      SELECT 1 FROM b2b_offer_promotions WHERE commercial_group_id IS NOT NULL
       GROUP BY offer_id, promotion_id, commercial_group_id HAVING count(*) > 1) d),
  'pode_prosseguir', true
) AS preflight_promocao_por_linha;
