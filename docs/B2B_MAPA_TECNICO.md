# B2B — Mapa técnico da Bio Florais

Complemento de `PLAYBOOK_B2B_ANGEL_BLANC.md` (regras de negócio, papéis e ordem de implantação). Este arquivo diz **onde cada coisa está no código e no banco** da Bio Florais, para que alguém consiga replicar numa marca nova. Atualizado em 11/10/2026 sobre o commit `65f7640`. Histórico detalhado e saídas reais: `ENTREGA_BIO_B2B.md`.

---

## 0. Como o B2B é montado

- **Stack:** Next.js 16 (App Router) na Vercel, Postgres no Neon (projeto `bio-florais`), drizzle-orm para leituras simples e **SQL puro sobre um `SqlRunner`** (`getAppSqlRunner()` em `src/lib/b2b/ownership.ts`, Neon HTTP) para a maior parte das regras — o que permite testar a mesma consulta em PGlite (`scripts/*.test.mjs`).
- **Esquema do banco NÃO usa migrations do drizzle.** Cada mudança é um par `NNa_*_preflight_one_shot.sql` (só leitura, 1 linha JSON) + `NNb_*.sql` (aditivo, `BEGIN/COMMIT`, `IF NOT EXISTS`) em `sql/b2b/`, aplicado à mão no Neon. `src/lib/db/schema.ts` só espelha o que o app lê.
- **Tolerância a SQL ainda não aplicado:** colunas novas lidas por `to_jsonb(r) ->> 'coluna'` ou dentro de `try/catch`, para o código novo poder subir antes do SQL (ex.: `NOT_DEMO_SQL`, `notArchivedCondition`, `loadDemoState`).
- **Preço, promoção, comissão e frete são calculados só no servidor** (`quote.ts`); o navegador manda `productId/qty`, CEP e cupom.
- **Isolamento:** toda rota do vendedor passa por `requireResponsible` e por `ownership.ts` (só clientes/ofertas do vendedor logado). Link do cliente = token opaco (só o SHA-256 no banco).

---

## 1. Rotas

### 1.1 Páginas do vendedor (`/b2b/...`)
| Rota | Função |
|---|---|
| `/b2b/login` | login por e-mail **ou** login + senha |
| `/b2b/convite/[token]` | cadastro rápido pelo convite (nome, WhatsApp, e-mail, senha; 7 dias de teste) e redefinição de senha |
| `/b2b/painel` | clientes, **Link padrão**, **Meu link de captação**, interesses (linha vista fora da oferta) |
| `/b2b/painel/cadastro` | cadastro completo (CPF/CNPJ, endereço, Pix/banco, termo RCA); "Usar meus dados de <marca>" (V4) |
| `/b2b/painel/cliente/[clientId]` | ofertas do cliente: ver condições, copiar/WhatsApp/QR, novo link, revogar |
| `/b2b/painel/cliente/[clientId]/oferta` | **Offer Builder** (linhas, promoção por linha, comissão base + extra) |
| `/b2b/painel/cliente/[clientId]/oferta/revisao` | revisão obrigatória + "Gerar link" |
| `/b2b/painel/comissoes` | Minhas comissões (por item, valor em R$) |
| `/b2b/painel/modelos`, `/b2b/painel/modelos/[id]` | **Minhas ofertas padrão** (lista, criar/editar com o mesmo Offer Builder) |
| `/b2b/demo/[token]` | entrada do **modo demonstração** (route handler: cria o vendedor demo e redireciona) |
| `/b2b/demo-invalido`, `/b2b/demo-expirada` | telas de link inválido/limite e demo terminado |

### 1.2 Páginas do cliente (lojista)
| Rota | Função |
|---|---|
| `/b2b/oferta/[token]` | home da oferta: cards das linhas (oferta em destaque + "Outras linhas") |
| `/b2b/oferta/[token]/linha/[slug]` | produtos da linha, bonificação/desconto ao vivo |
| `/b2b/oferta/[token]/pedidos` | Meus pedidos |
| `/b2b/carrinho`, `/b2b/checkout` | sacola por link (`?b2b=<token>`) e checkout (Pix padrão, cartão até 3x, boleto PJ) |
| `/parceiros` | página pública para o flyer (noindex): linhas, preço B2B, cadastro rápido do lojista (`?v=<código>`) |
| `/acompanhe-seu-pedido`, `/acompanhe/[token]` | busca por e-mail + CPF/CNPJ (ou nº do pedido) e andamento do pedido |

### 1.3 Admin (`/admin`, sessão `ADMIN_SESSION_SECRET`)
| Rota | Função |
|---|---|
| `/admin/(protected)/b2b` | abas: Vendedores/RCAs (cartões, convites, **link de demonstração**, código de captação, vendedor da casa), Linhas comerciais, Promoções, Acompanhamento, Boletos a receber, Comissões, Mensagens ao lojista, Dados de teste |
| `/admin/(protected)/pedidos`, `.../[id]` | pedidos (B2C e B2B), imprimir separação, andamento, **Marcar como teste e arquivar** |

### 1.4 API do vendedor e do cliente (`/api/b2b/*`)
| Rota | Função |
|---|---|
| `auth/login`, `auth/logout` | sessão do vendedor (cookie `bioflorais_b2b_session`) |
| `invites/accept` | aceite do convite (rápido ou completo) |
| `profile/complete` | cadastro completo + termo RCA; dispara a replicação para as outras marcas (`after()`) |
| `clients` | listar/criar clientes do vendedor |
| `offers/draft`, `offers/[offerId]/activate`, `offers/link` | rascunho, ativação, copiar/gerar/revogar link |
| `offers/quick` | **Link padrão** (todas as linhas, sem promoção) |
| `offer-templates`, `offers/from-template` | modelos do vendedor e geração com conferência (`preview`) |
| `line-views` | "cliente abriu linha fora da oferta" |
| `shipping/quote` | cotação autoritativa (`computeB2BQuote`) |
| `orders/create` | cria o pedido B2B + snapshot de promoção/comissão por item |
| `payments/mercadopago/pix`, `payments/mercadopago/card`, `payments/lunium/pix`, `payments/boleto` | pagamentos (todos conferem token da oferta; demo é recusado) |
| `retailer-messages/seen` | marca o pop-up de 1º acesso como visto |
| `demo-status` | "este link é de demonstração?" (faixa nas telas do cliente) |

### 1.5 API do admin (`/api/admin/*`)
`login` · `b2b/responsibles` (+`/[id]`: deactivate, reactivate, reset_access, extend_trial, edit_identity, release_email, set_omie_vendor, set_referral_code, ensure_referral_code, set_house) · `b2b/invites` (+`/[id]`) · `b2b/promotions` (+`/[id]`) · `b2b/commercial-groups` (+`/[id]`) · `b2b/products` · `b2b/boletos` (baixa/desfazer) · `b2b/commissions` (marcar paga) · `b2b/tracking` · `b2b/messages` (+`/settings`) · `b2b/settings` · `b2b/test-data` (candidatos, arquivar, desfazer lote) · `b2b/demo-links` (criar/listar/revogar) · `orders/[id]/events|fulfillment|shipment` · `orders/archive`.

### 1.6 Contrato Central ⇄ marca (`/api/central/*`, header `x-central-secret` = `CENTRAL_API_SECRET`)
| Rota | Função |
|---|---|
| `POST invites` | cria o convite de vendedor/RCA (mesmas regras do admin; 409 `EMAIL_IN_USE` cita o dono) |
| `GET orders?stage=separation\|tracking\|shipped` | pedidos pagos a separar / separados sem rastreio / enviados |
| `POST orders/[id]/progress` | `separating`, `separated`, `shipped` (carrier + código), `delivered`; grava `order_events` "Central · <nome>" |
| `GET/POST sellers/profile` | consulta e replica o cadastro completo do vendedor (V4) |

A Bio **chama** a Central (`CENTRAL_URL`) em `lib/central/central-client.ts`: `GET /api/central/sellers/lookup` e `POST /api/central/sellers/replicate`. Sem as variáveis, nada quebra.

### 1.7 Cron (`vercel.json`, `Authorization: Bearer CRON_SECRET`)
| Rota | Quando | Função |
|---|---|---|
| `/api/cron/reconcile-mp-pix` | a cada 10 min | converge Pix do Mercado Pago pago que o webhook perdeu |
| `/api/cron/cleanup-b2b-demo` | diário 06:30 UTC | apaga vendedor demo **expirado** e o que é dele |

### 1.8 Outras rotas usadas pelo B2B
`/api/orders/create|status|track|track-link` (B2C e acompanhamento), `/api/catalog/images` (fotos reais por slug), `/api/webhooks/*` (Mercado Pago, Lunium, PixGo), `/api/quiz/product-image`.

---

## 2. Tabelas e colunas B2B

> Coluna "origem" = SQL que criou/alterou. Tabelas marcadas `*` não estão no `schema.ts` (acesso só por SQL puro).

### 2.1 Pessoas e vínculos
| Tabela | Colunas principais e função |
|---|---|
| `b2b_responsibles` | vendedor. `type` (`rca`\|`clt`), `status`, `name`, `email`, `phone`, `login`, `password_hash`, `last_login_at`. **Teste/cadastro:** `trial_ends_at`, `profile_completed_at` (26b), dados do cadastro completo (`person_type`, `cpf`, `rg`, `cnpj`, `state_registration`, `pix_key`, `bank_*`, endereço) e `rca_terms_accepted_at/ip/version`. **Omie:** `omie_vendor_code` (30b). **Identidade:** `email_original`, `login_original`, `released_at` (31b). **Arquivo/teste:** `is_test`, `archived_at` (32b). **Captação:** `referral_code` (35b). **Demo:** `is_demo`, `demo_expires_at`, `demo_link_id` (36b) |
| `b2b_responsible_invites` | convites (`purpose` = `onboarding` \| `password_reset`, `token_hash`, `token_ciphertext` p/ copiar de novo, `status`, `expires_at`) |
| `b2b_clients` | lojista do vendedor: `display_name`, `contact_name`, `email`, `phone`, `customer_id`, `active`; `is_test`, `archived_at` (32b); `document`, `city`, `state`, `lead_source`, `lead_referral_code` (35b, captado por /parceiros) |
| `b2b_client_relationships` | vínculo cliente × vendedor (`active`, `unlinked_at`): **a regra de isolamento** |

### 2.2 Catálogo comercial e promoções
| Tabela | Função |
|---|---|
| `products` (B2C) | catálogo; `price_cents` é a base do preço B2B |
| `b2b_commercial_groups` | linhas comerciais (`slug`, `active`, `b2b_visible`, `sort_order`); card da Home por `line-images.ts` |
| `b2b_commercial_group_products` | produtos de cada linha |
| `b2b_promotions` | promoção: `type` (`buy_x_get_y_auto_same_sku` \| `percentage_discount`), `buy_quantity`, `free_quantity`, `percentage`, `promo_type` (`abertura_reconquista` \| `recorrente`, 14b), `seller_selectable`, vigência, `active` |
| `b2b_promotion_commercial_groups`, `b2b_promotion_products` | alcance (linhas e/ou SKUs) |
| `b2b_promotion_terms` | termos legados (validade por prazo) |
| `b2b_commission_rules`* | **tabela de comissão:** `scope` (`responsible_base`, `normal_price`, `promotion_eligibility`), `base_percent`, `extra_percent`, `promotion_id`, `eligibility_mode` (`uses`/`days`), `max_uses`, `duration_days`, com `responsible_id`/`client_id` opcionais (mais específico vence) |
| `b2b_settings`* | chave/valor: `reconquista_meses`, `retailer_banner_seconds`, `retailer_button_seconds`, `house_responsible_id` (vendedor da casa) |

### 2.3 Oferta e link
| Tabela | Função |
|---|---|
| `b2b_offers` | oferta do cliente (`status` draft/active, `activated_at`, `revoked_at`) |
| `b2b_offer_commercial_groups` | linhas da oferta |
| `b2b_offer_promotions` | **escolha por (promoção, LINHA):** `commercial_group_id`, `eligibility_mode`, `max_uses`, `duration_days`, `valid_from/valid_until`. Chave única `(offer_id, promotion_id, commercial_group_id)` (33b) |
| `b2b_offer_links` | link opaco (`token_hash`, `token_ciphertext`, `revoked_at`) |
| `b2b_offer_line_views`* | "abriu a linha X fora da oferta" |
| `b2b_offer_templates`* | modelos do vendedor (`commercial_group_ids`, `promotions` jsonb) (34b) |

### 2.4 Pedido, pagamento e andamento (compartilhado com o B2C)
| Tabela | Colunas B2B / função |
|---|---|
| `orders` | `b2b_client_id`, `b2b_offer_id`, `b2b_responsible_id/type/name`, `payment_method`, `payment_method_discount_cents`, `shipping_*`, `tracking_code`, `fulfillment_status`; `is_test`, `archived_at` (32b) |
| `order_items` | **snapshot congelado por item:** `paid_qty`, `bonus_qty`, `physical_qty`, `promotion_id/name/buy_quantity/free_quantity`, `commission_base/extra/total_percent`, `commission_basis` (13b), `promotion_type/percent/discount_cents` (17b), `product_name_snapshot` (21b, o que Central/Omie leem). Bonificado = linha de preço 0 |
| `payments` | tentativas/status do Pix e cartão |
| `b2b_boleto_requests`* | solicitação de boleto: `installments`, `schedule` jsonb (vencimentos 28/42/56) (04b) |
| `b2b_boleto_payments`*, `b2b_boleto_payment_log`* | **baixa por parcela** e log (20b) |
| `b2b_commission_payouts`*, `b2b_commission_payout_log`* | comissão marcada como paga ao vendedor (18b) |
| `order_events`*, `order_tracking_attempts`* | andamento (separação, enviado, entregue) e limite de buscas do acompanhamento (23b) |

### 2.5 Operação
| Tabela | Função |
|---|---|
| `b2b_retailer_messages`*, `b2b_retailer_popup_views`* | mensagens ao lojista (22b, 25b) |
| `b2b_archive_log`* | lote de arquivamento (dados de teste) para desfazer (32b) |
| `b2b_demo_links`*, `b2b_demo_creations`* | links de campanha (só hash) e limite por IP (36b) |

---

## 3. SQL, na ordem em que foi aplicado

Sempre `a` (preflight, só leitura) antes do `b` (aditivo). Backup do Neon antes; conferir o projeto pelo produto (slug típico da Bio).

| SQL | O que faz |
|---|---|
| `01_preflight_readonly` / `01b_preflight_one_shot` | confere o banco antes de qualquer B2B |
| `02_candidate_if_not_exists` | tabelas base `b2b_*` (vendedores, convites, clientes, linhas, ofertas, links, promoções) |
| `03a/03b` | admin B2B: `purpose` do convite, redefinição de acesso |
| `04a/04b` | cronograma do boleto (`schedule`) |
| `05a/05b` | `b2b_offer_line_views` (interesses) e abas do admin |
| `06a/06b` | seed de promoções de teste (substituído pelo 29b) |
| `07a/07b` | Offer Builder: `commercial_group_id`, `eligibility_mode`, `duration_days` na oferta; snapshot de promoção/comissão no item |
| `08a`, `08b`, `08c` | tira o grupo/vendedor/cliente de teste que vazou |
| `09b` | cards das demais linhas da Home |
| `10a`, `10b` | conferências (comissão congelada, isolamento) |
| `11b` | link da oferta cifrado (copiar de novo) |
| `12a/12b` | corrige texto quebrado (mojibake) |
| `13a/13b` | `commission_basis` (janela de 180 dias) |
| `14a/14b` | `promo_type` + `b2b_settings` (`reconquista_meses`) |
| `15a`, `16a`, `16b` | contador de usos; elegibilidades padrão para promoções sem regra |
| `17b` | snapshot da promoção percentual |
| `18b` | pagamento de comissão ao vendedor |
| `19b` | convite cifrado |
| `20b` | baixa de boleto por parcela |
| `21b` | `product_name_snapshot` |
| `22b` | mensagens ao lojista |
| `23b` | `order_events` e limite do acompanhamento |
| `25b` | chamada curta e rodízio das mensagens |
| `26a/26b`, `27a/27b`, `28a/28b` | período de teste de 7 dias, cadastro completo, vendedores antigos, colunas opcionais |
| `29a/29b` | promoções reais de outubro/26 (B1 a B11) |
| `30a/30b` | "Vendedor no Omie" |
| `31a/31b` | e-mail preso: `email_original`, `login_original`, `released_at` |
| `32a/32b` | dados de teste: `is_test`, `archived_at`, `b2b_archive_log` |
| `33a/33b` | promoção por (promoção, linha): nova chave única |
| `34a/34b` | `b2b_offer_templates` |
| `35a/35b` | `referral_code`, dados do lojista captado |
| `36a/36b` | modo demonstração |

(Não existe `24b` na Bio.)

---

## 4. Onde ficam as regras (arquivos)

| Regra | Arquivo |
|---|---|
| Preço B2B (floral fixo R$19,90; demais 55% do B2C arredondado + 0,90), pedido mínimo R$250, parcelas (até 3x, mínima R$500), vencimentos do boleto, descontos Pix/cartão, modalidade de frete mais barata ≥ R$450 | `src/lib/b2b/pricing.ts` |
| Ordem única do cálculo (promoção % → mínimo → cupom → Pix/cartão → frete), cotação autoritativa | `src/lib/b2b/quote.ts` |
| Promoção: elegibilidade, alcance, bonificação X+Y e desconto %, **por (promoção, linha)** | `promotion-resolver.ts` (carrega), `promotion-lines.ts` (parte pura), `promotion-engine.ts`, `promotion-scope.ts` |
| Abertura × recorrente, ciclo por linha, "compra" = pago ou boleto não cancelado, contador de usos | `purchase-history.ts`, `promotion-gate.ts` |
| Comissão: matriz (base + extra), janela de 180 dias, snapshot por item | `commission.ts`, `commission-window.ts`, `order-commission.ts` |
| Minhas comissões / comissão do admin (dia 10 do mês seguinte, boleto por parcela) | `commissions.ts`, `boleto-installments.ts` |
| Frete real (Melhor Envio) e CEP × UF | `src/lib/shipping/*` |
| Cupom B2B (escopo `b2b`; B2B e B2C exclusivos) | `coupon-resolver.ts` |
| Contexto público do link e conferência do token no pagamento | `public-offer-context.ts`, `token.ts`, `offer-link.ts` |
| Offer Builder: linhas, promoções disponíveis por cliente, validação do rascunho, revisão | `offer-builder.ts`, `offer-draft-input.ts`, `offer-review.ts`, `quick-offer.ts`, `offer-templates.ts` |
| Isolamento do vendedor | `ownership.ts`, `require-responsible.ts`, `current-responsible.ts` |
| Período de teste e cadastro completo | `vendor-profile.ts`, `rca-terms.ts` |
| Identidade (editar e-mail, liberar e-mail) | `vendor-identity.ts` |
| Arquivamento de dados de teste | `archive.ts`, `test-data.ts` |
| Parceiros (código, vendedor da casa, lead) | `partners.ts` |
| Demonstração | `demo.ts` |
| Contrato Central ⇄ marca | `src/lib/central/` (`contract.ts`, `brand-api.ts`, `order-progress.ts`, `central-client.ts`, `secret.ts`) |
| Nome completo do produto (tipo + nome + linha + volume) | `product-label.ts`, `src/lib/cart-display.ts` |
| Analytics sem token na URL | `src/lib/analytics-url.ts` |

---

## 5. Testes principais

`npm test` roda `scripts/*.test.mjs` (Node test runner; PGlite = Postgres em memória). Os que cobrem o B2B:

| Arquivo | Cobre |
|---|---|
| `b2b-pricing`, `b2b-offer-builder`, `b2b-commission-window`, `b2b-commissions` | preço, validação da oferta, comissão congelada, janela de 180 dias, Minhas comissões |
| `b2b-promotion-cycles`, `b2b-promotion-admin`, `b2b-promocoes-out26`, `b2b-promocao-por-linha` | abertura/recorrente, contador de usos, promoções reais, escolha por (promoção, linha) |
| `b2b-boletos`, `b2b-boletos-solicitacoes` | parcelas, baixa, solicitações |
| `b2b-vendor-isolation`, `b2b-vendor-login`, `b2b-vendor-trial`, `b2b-invites`, `b2b-email-preso`, `b2b-vendedores-cartao`, `b2b-omie-vendor` | isolamento, login, teste de 7 dias, convites, e-mail, tela de vendedores |
| `b2b-central` | contrato `/api/central/*`, replicação de cadastro, Analytics |
| `b2b-dados-de-teste`, `b2b-pedidos-arquivar`, `b2b-comissoes-arquivados` | arquivar/desfazer, pago real com confirmação |
| `b2b-link-padrao`, `b2b-ofertas-padrao`, `b2b-qrcode`, `b2b-parceiros`, `b2b-demo` | L1, L2, QR, /parceiros, demonstração |
| `b2b-retailer-messages`, `b2b-tracking`, `b2c-p1-*` | mensagens, acompanhamento, melhorias do B2C |

Antes de publicar: `npx tsc --noEmit`, `npm test`, `npm run build` (com `DATABASE_URL` e `ADMIN_SESSION_SECRET` de mentira) e `git diff --check`.

---

## 6. Diferenças da Bio em relação às outras marcas

| Tema | Bio | Outras |
|---|---|---|
| Rotas do vendedor | `/b2b/...` e `/api/b2b/...` | Secreta igual; My Pet usa `/area-interna/b2b/...` (alias `/b2b/login`) |
| Sessão do vendedor | cookie `bioflorais_b2b_session`, HMAC com `ADMIN_SESSION_SECRET` | Secreta usa `B2B_SESSION_SECRET` |
| Tipos de vendedor | `rca` / `clt` (minúsculas); o contrato da Central usa `RCA` / `VENDEDOR` e a Bio converte | My Pet usa `RCA`/`VENDEDOR` direto |
| Catálogo | estático em `src/lib/catalog/bio-products.ts` (o campo `image` aponta para arquivos inexistentes; as fotos reais estão em `public/products/<linha>/...`, resolvidas por `product-images.server.ts` / `/api/catalog/images`) | tabelas/arquivos próprios |
| Pagamentos | Mercado Pago (`MERCADOPAGO_*`, não `MERCADO_PAGO_*`), Lunium e PixGo para Pix; boleto por solicitação (`b2b_boleto_requests`) | provedores variam |
| Preço B2B | floral R$ 19,90 fixo; demais 55% do B2C + 0,90 | tabelas próprias por marca |
| Esquema | sem migrations do drizzle; `sql/b2b/NNa/NNb` à mão; consultas tolerantes a coluna ausente | My Pet usa `drizzle/00NN_*.sql` + consolidado |
| Número do pedido | `BIO-` + 8 primeiros do id | `MPM-` (My Pet) |
| Central | a Bio implementa as rotas `/api/central/*`; **a Central em si mora na My Pet** | — |
| Isolamento do B2C | rodapé/carrinho/"criadora" do B2C ocultos no B2B e em `/parceiros` (`HideOnB2B`) | cada marca tem o seu |
| Admin | uma aba de Vendedores com cartões; modo demo e parceiros ficam nela | iguais (Rodadas 5–6) |

---

## 7. Variáveis de ambiente

`DATABASE_URL` · `ADMIN_SESSION_SECRET` (assina admin, sessão do vendedor, cookie do demo e cifra os links) · `NEXT_PUBLIC_SITE_URL` · `CRON_SECRET` · `CENTRAL_API_SECRET` e `CENTRAL_URL` (Central) · `B2B_DEMO_CTA_URL` (botão "Quero ser representante") · `MERCADOPAGO_*` · `NEXT_PUBLIC_PIX_PROVIDER` e chaves do provedor · Melhor Envio (`MELHORENVIO_*`).

---

## 8. Checklist para replicar numa marca nova

1. Catálogo estável com nome completo e foto resolvível por slug.
2. Tabelas da seção 2 (use `sql/b2b/` como molde, na ordem da seção 3; sem o seed de teste).
3. Ligar as regras da seção 4 (`pricing.ts` é o único arquivo com valores por marca; promoções e comissão vêm do banco).
4. Rotas das seções 1.1 a 1.5 e o contrato da 1.6 (testes `b2b-central` como roteiro).
5. Crons da 1.7, variáveis da seção 7 e `vercel.json`.
6. Rodar a suíte da seção 5 adaptada e conferir o isolamento entre vendedores e entre demo e real.
