-- ============================================================================
-- BIO FLORAIS — 50a: CONFERÊNCIA do cupom GPT10 (Rodada 20). Projeto Neon: bio-florais.
-- SOMENTE LEITURA, uma linha JSON. Rode antes e depois do 50b.
-- Validade esperada: 30/11/2026 23:59:59 (Brasília) = 2026-12-01 02:59:59 UTC (coupons.expires_at é timestamp sem fuso, em UTC).
-- ============================================================================
SELECT json_build_object(
  'tabela_coupons_existe', to_regclass('public.coupons') IS NOT NULL,
  'colunas_necessarias_existem', (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'coupons'
        AND column_name IN ('code', 'discount_type', 'discount_value', 'coupon_type', 'scope', 'one_per_customer', 'expires_at', 'active', 'min_subtotal_cents', 'commission_percent', 'discounts_shipping')) = 11,
  'gpt10_existe', EXISTS (SELECT 1 FROM coupons WHERE code = 'GPT10'),
  'gpt10', (SELECT row_to_json(c) FROM (
      SELECT code, discount_type, discount_value, coupon_type, scope, one_per_customer, active, min_subtotal_cents, max_uses, used_count,
             to_char(expires_at, 'YYYY-MM-DD HH24:MI:SS') AS expira_em_utc,
             to_char(expires_at - interval '3 hours', 'DD/MM/YYYY HH24:MI:SS') AS expira_em_brasilia
        FROM coupons WHERE code = 'GPT10') c),
  'gpt10_conforme', EXISTS (SELECT 1 FROM coupons WHERE code = 'GPT10' AND discount_type = 'percentage' AND discount_value = 10
      AND coupon_type = 'normal' AND scope = 'b2c' AND one_per_customer = true AND active = true AND discounts_shipping = false
      AND commission_percent = 0 AND min_subtotal_cents = 0 AND expires_at = timestamp '2026-12-01 02:59:59'),
  'usos_gpt10', (SELECT count(*) FROM coupon_redemptions r JOIN coupons c ON c.id = r.coupon_id WHERE c.code = 'GPT10'),
  'pode_prosseguir', to_regclass('public.coupons') IS NOT NULL
) AS conferencia_cupom_gpt10;
