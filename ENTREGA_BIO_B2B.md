# Entrega — Bio Florais B2B (candidata limpa)

- **Pasta:** `C:\Users\User\bio-b2b-limpa` (worktree de `C:\Users\User\BioFlorais`)
- **Branch:** `b2b/bio-limpa-v1` (local, **sem push**)
- **Base:** `origin/main` = `c15c0c8`
- **Data:** 30/09/2026

Nada foi feito em `C:\Users\User\BioFlorais`: nenhum arquivo foi alterado ou descartado lá, a main não foi tocada e o Neon não foi acessado. Não houve seed, deploy, push nem pagamento real. As outras marcas também não foram alteradas.

---

## 0. Atenção: base diferente do que o prompt chama de "produção"

O prompt diz que `main` = `e9954b3` é a produção, mas a `origin/main` está em `c15c0c8`. As duas divergiram:

- `origin/main` tem commits que a `main` local não tem: `47964fd`, `3ec393b`, `bc130d9` (merge da PR #1) e `c15c0c8`.
- A `main` local tem um commit que não está na `origin/main`: `e9954b3 fix: persistir parcelas e corrigir build do checkout`.

A candidata segue o comando do prompt (`worktree add ... origin/main`), então **`e9954b3` não está incluído**. Antes de publicar, confirmar qual das duas é a produção de fato. Se for `e9954b3`, basta fazer rebase ou cherry-pick desta branch: os arquivos B2B são novos e o diff nos arquivos B2C é pequeno (seção 3).

## 1. Commits

```
e15b51e feat(b2b/bio): telas B2B (oferta, carrinho, checkout, login e painel)
097b29b feat(b2b/bio): regras comerciais, cotacao autoritativa e rotas B2B
d5ae52e feat(b2b/bio): schema B2B (so adicoes) + preflight somente leitura e SQL candidato
```

(Este arquivo `ENTREGA_BIO_B2B.md` vai num 4º commit, só de documentação.)

## 2. Verificações (execução real nesta pasta)

| Verificação | Resultado |
|---|---|
| `npm.cmd ci` | exit 0 |
| `npx.cmd tsc --noEmit -p .` | **exit 0** (sem erros) |
| `npm.cmd run build` (Next 16.3.2) | **exit 0**: compilou, TypeScript ok, 42/42 páginas, todas as rotas `/b2b/*` e `/api/b2b/*` geradas |
| `git diff --check origin/main..HEAD` | **vazio** |
| `eslint` | 0 problemas nos arquivos B2B novos. `eslint src` inteiro: 12 erros, todos em código B2C que já existia; nenhum foi introduzido por esta branch (o `any` em `orders/[orderId]/status/route.ts` é de uma linha original) |
| Encoding | todos os arquivos novos ou alterados são UTF-8 válido; busca por mojibake (`Ã§`, `Ã£`, `â€`, `Â·`...) nos arquivos B2B: nenhum |
| `schema.ts` | **só adições** (+351 / −0). BOM e CRLF originais preservados byte a byte |
| Regras puras (`pricing.ts`) | script com asserts via `node --experimental-strip-types`: ok |

**Sobre o build:** o build sem variáveis de ambiente falha numa rota B2C que já existia antes desta branch (`/api/admin/orders/[id]/fulfillment`). O motivo é que `src/lib/db/client.ts` lança erro na importação quando `DATABASE_URL` não existe. O build verde acima rodou com `DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build_placeholder`. Esse endereço é fictício e local: o driver HTTP do Neon não conecta no build, e o Neon não foi acessado. Na Vercel a variável real já existe.

### `git diff --stat origin/main..HEAD`

```
 sql/b2b/01_preflight_readonly.sql                  | 176 ++++++
 sql/b2b/02_candidate_if_not_exists.sql             | 123 ++++
 src/app/api/b2b/auth/login/route.ts                |  69 +++
 src/app/api/b2b/auth/logout/route.ts               |  11 +
 src/app/api/b2b/clients/route.ts                   |  84 +++
 src/app/api/b2b/commercial-groups/route.ts         |  29 +
 src/app/api/b2b/offers/link/route.ts               | 133 ++++
 src/app/api/b2b/offers/mine/route.ts               |  70 +++
 src/app/api/b2b/offers/route.ts                    | 141 +++++
 src/app/api/b2b/orders/create/route.ts             | 301 +++++++++
 src/app/api/b2b/payments/boleto/route.ts           | 191 ++++++
 src/app/api/b2b/payments/lunium/pix/route.ts       | 260 ++++++++
 src/app/api/b2b/payments/mercadopago/card/route.ts | 193 ++++++
 src/app/api/b2b/promotions/route.ts                |  41 ++
 src/app/api/b2b/shipping/quote/route.ts            |  74 +++
 src/app/api/coupons/validate/route.ts              |   5 +-
 src/app/api/orders/[orderId]/status/route.ts       |  14 +-
 src/app/api/orders/create/route.ts                 |   6 +-
 src/app/api/webhooks/lunium/route.ts               |  35 ++
 src/app/b2b/carrinho/B2BCartContent.tsx            | 106 ++++
 src/app/b2b/carrinho/page.tsx                      |  11 +
 src/app/b2b/checkout/B2BCheckoutContent.tsx        | 681 +++++++++++++++++++++
 src/app/b2b/checkout/page.tsx                      |  11 +
 src/app/b2b/layout.tsx                             |  13 +
 src/app/b2b/login/page.tsx                         |  71 +++
 src/app/b2b/oferta/[token]/page.tsx                |  94 +++
 src/app/b2b/painel/page.tsx                        | 257 ++++++++
 src/components/b2b/B2BOfferCatalog.tsx             | 166 +++++
 .../payments/B2BMercadoPagoCardPayment.tsx         | 151 +++++
 src/lib/b2b/cart-context.tsx                       | 173 ++++++
 src/lib/b2b/coupon-resolver.ts                     | 127 ++++
 src/lib/b2b/format.ts                              |   6 +
 src/lib/b2b/password.ts                            |  39 ++
 src/lib/b2b/pricing.ts                             | 279 +++++++++
 src/lib/b2b/promotion-engine.ts                    |  23 +
 src/lib/b2b/promotion-resolver.ts                  | 183 ++++++
 src/lib/b2b/public-offer-context.ts                | 249 ++++++++
 src/lib/b2b/quote.ts                               | 272 ++++++++
 src/lib/b2b/require-responsible.ts                 |  41 ++
 src/lib/b2b/responsible-session.ts                 |  92 +++
 src/lib/b2b/token.ts                               |  14 +
 src/lib/db/schema.ts                               | 351 +++++++++++
 src/lib/shipping/cep-lookup.ts                     |  41 ++
 43 files changed, 5403 insertions(+), 4 deletions(-)
```

## 3. Arquivos B2C tocados (diff mínimo)

| Arquivo | Mudança | Efeito no B2C |
|---|---|---|
| `api/coupons/validate` | filtro `scope = 'b2c'` | cupom B2B deixa de valer no B2C (todo cupom existente fica `b2c` pelo DEFAULT) |
| `api/orders/create` | mesmo filtro no cupom comercial | idem |
| `api/webhooks/lunium` | pedido **B2B** só vira `paid` se `amount_cents == orders.total_cents` | nenhum: o bloco só roda quando `b2b_offer_id` está preenchido |
| `api/orders/[orderId]/status` | mesma regra no polling Lunium | nenhum: pedido B2C passa direto |

## 4. Inventário do B2B antigo em `C:\Users\User\BioFlorais` (só leitura)

`git status --short` tem 480 entradas. As que são B2B:

- `src/app/api/b2b/auth/login/route.ts`: **aproveitado como padrão**. Mantive a query por `lower(login)`, a exigência de `status = 'active'` e o formato de senha `scrypt$<salt b64url>$<hash b64url>`. Esse formato é obrigatório para não invalidar senhas já gravadas; a Secreta usa hex, que é incompatível.
- `src/lib/b2b/responsible-session.ts`: **aproveitado**. Mesmo cookie `bioflorais_b2b_session` e mesmo HMAC com `ADMIN_SESSION_SECRET`, então não precisa de variável de ambiente nova.
- `src/app/api/b2b/offers/link/route.ts`: **aproveitado como padrão**. Gerar um link novo revoga o anterior e o banco guarda só o hash.
- `src/lib/b2b/public-offer-context.ts`: padrão aproveitado. Foi reescrito no formato da Secreta, que valida link, oferta, cliente, responsável e vínculo, e ganhou a função `verifyB2BOrderOfferToken`.
- `src/lib/b2b/price-resolver.ts`: **reaproveitada só a lista de categorias florais**. O arquivo tinha mojibake (`Floral dose Ãºnica`), e a regra antiga de 55% arredondava para inteiro terminando em ",90". Substituí pela regra fechada (ver seção 6).
- `src/lib/b2b/promotion-engine.ts` / `promotion-resolver.ts`: **descartados**. Dependem de `b2b_promotion_opening_consumptions`, que não existe no Neon da Bio segundo a introspecção anterior, e de colunas de snapshot em `order_items`. No lugar entrou o motor "compre X, leve Y" da Secreta.
- `src/app/b2b/oferta/**` e `src/components/b2b/B2BProductPurchaseActions.tsx`: **descartados**. Tinham mojibake (`Â·`, `Ãrea`, `â†’`) e usavam o carrinho e o checkout **B2C** (`/checkout?b2b=`). Foram refeitos com carrinho e checkout B2B próprios.
- `src/lib/db/schema.ts` (sujo): **não copiado**. Tinha regressões: tirava o BOM, reescrevia comentários, trocava CRLF e declarava tabelas que não existem. Dele aproveitei só a **estrutura introspectada** das 14 tabelas `b2b_*` e das colunas `orders.b2b_*`, redeclarada como adição.
- Arquivos `*.before-*` e `drizzle*/`: ignorados, de propósito.

Referência de implementação: Secreta B2B em `C:\Users\User\secreta-b2b-validacao` (branch `b2b/secreta-v2`, commits até `39b5abf`, mais as mudanças ainda não commitadas daquela janela, que adicionam `totalsByPaymentMethod`).

## 5. Banco

- **Nada de journal Drizzle, `drizzle-kit migrate` ou `push`.** Os SQLs ficam em `sql/b2b/`.
- `sql/b2b/01_preflight_readonly.sql`: `BEGIN TRANSACTION READ ONLY ... ROLLBACK`. Traz tabelas, colunas (tipo, nulabilidade, default), índices, constraints das tabelas `b2b_*` e de `orders`/`coupons`/`payments`, além de checagens de dados: formato de hash, ofertas sem `activated_at`, produtos sem dimensão, categorias ativas e boletos duplicados.
- `sql/b2b/02_candidate_if_not_exists.sql`: só `ADD COLUMN IF NOT EXISTS`, `CREATE ... IF NOT EXISTS` e `CHECK ... NOT VALID` condicionado a `pg_constraint`. Não tem DROP, ALTER TYPE nem UPDATE. O conteúdo:
  - `orders`: `b2b_client_id`, `b2b_offer_id`, `b2b_responsible_id/type/name`, `payment_method`, `payment_method_discount_cents` (sem FK, igual ao banco real) e um índice parcial em `b2b_offer_id`.
  - `coupons`: `scope` (default `b2c`) e `discounts_shipping` (default `false`), mais CHECKs para `scope ∈ {b2c,b2b}` e para "desconta frete ⇒ cupom percentual".
  - `b2b_boleto_requests` (se não existir), com índice único em `order_id`.
  - Índice único parcial `payments(order_id) WHERE method = 'boleto'`.
  - As 14 tabelas `b2b_*` que já existem **não** são recriadas. Se o preflight [2] listar alguma como faltando, é preciso parar e revisar antes.

> ⚠️ **Bloqueio de deploy:** o `schema.ts` passa a declarar `orders.payment_method`, `orders.payment_method_discount_cents`, `coupons.scope` e `coupons.discounts_shipping`. Várias rotas **B2C** fazem `db.select().from(orders)` ou `.from(coupons)` e selecionam todas as colunas declaradas. Por isso, se alguma dessas colunas não existir no Neon, o B2C quebra. **Só publicar depois que o preflight [3] mostrar tudo `ok`**, seja porque as colunas já existem (as "10/10 colunas comerciais" da coleta de 25/09 podem ser justamente essas), seja porque o candidato foi aplicado.

## 6. Regras comerciais: como ficaram

| Regra | Implementação |
|---|---|
| Floral R$ 19,90 | `products.category` ∈ {Floral em gotas, Floral dose única, Floral de Ambiente, Snack Floral, Virtudes Divinas}, comparação sem acento e sem diferenciar maiúsculas |
| Demais 55% do B2C | `Math.round(price_cents × 0,55)`, igual à Secreta. **Diferença:** o candidato antigo da Bio usava "piso em reais + ,90". Confirmar se a regra fechada deve substituir aquele arredondamento |
| Mínimo R$ 250 | sobre os produtos, antes do cupom; checado na cotação e na criação do pedido |
| Cartão/boleto até 3x, parcela mínima R$ 500 | `resolveB2BAllowedInstallments`, conferido na criação, na rota de cartão e na rota de boleto |
| Pix só Lunium | `/api/b2b/payments/lunium/pix`; não existe rota Pix Mercado Pago no B2B |
| Pix 7% / cartão 3% / boleto cheio, **só sobre produtos** | `resolveB2BOrderTotalCents` = produtos pós-cupom − desconto + frete. O checkout mostra só o valor final de cada método, nunca o %. **Diferença:** a Secreta aplica o % sobre produtos **+ frete**. Alinhar lá se a regra fechada vale para os 3 |
| Frete ≥ R$ 450 (base pós-cupom) | a modalidade mais barata passa a custar `Math.min(tarifa regional, real)` (S/SE R$ 9,90; CO/NE exceto CE R$ 35,90; Norte + CE R$ 169,90); as demais ficam com preço cheio e nenhuma é ocultada; UF conferida pelo CEP (ViaCEP) no servidor; sem conferência, não há tarifa regional |
| Cupom B2B × B2C | `scope`; cupom de parceira nunca vale no B2B |
| Cupom de teste que desconta frete | `discounts_shipping`, **só percentual**: o mesmo % incide sobre o frete cobrado; o custo real (`shipping_cost_cents`) é preservado |
| Servidor recalcula tudo | `src/lib/b2b/quote.ts` é a **única** função usada pela cotação do checkout e pela criação do pedido |
| Token da oferta nos pagamentos | `verifyB2BOrderOfferToken`: a oferta do token precisa ser igual a `orders.b2b_offer_id` |
| Trava por método | `orders.payment_method`; cada rota de pagamento exige igualdade |
| Boleto | idempotente pelo banco (upsert com `xmax = 0`), composição exata `(n−1)·parcela + última = total`, registro em `payments` (`provider = boleto-manual`). **Não emite boleto real** |
| Webhook/polling Lunium | pedido B2B só vira pago com `amount_cents == total_cents` (valor ausente também bloqueia) |

Outras decisões:
- **Representante ativo** = `b2b_responsibles.status = 'active'` (convenção do login antigo da Bio; a Secreta usa `company_approved_at`).
- **RG** não é pedido: `customers` da Bio não tem essa coluna.
- **Cartão:** a chave de idempotência é por pedido + hash do card token, então um reenvio do mesmo token não cobra duas vezes e uma nova tentativa com outro cartão é permitida. A rota bloqueia uma segunda cobrança se já houver pagamento `paid`, `authorized` ou `pending`.
- **Cupom** é registrado na criação do pedido, no mesmo momento do B2C. O finalizador do Mercado Pago vê o registro e não duplica.

## 7. Fora do escopo / pendências conhecidas

1. Convite e onboarding de representante e aprovação pelo admin não foram portados. Usam-se os responsáveis que já existem no banco (login + senha).
2. A emissão do boleto é manual (só a solicitação é registrada).
3. As colunas de snapshot de promoção e comissão em `order_items` não são preenchidas; comissão B2B está fora do escopo.
4. O layout raiz ainda mostra os elementos do B2C (rodapé, botão do carrinho B2C quando ele tem itens) nas páginas `/b2b`.
5. Sem push nem PR: aguardando autorização do Luis.

## 8. Variáveis de ambiente usadas (todas já existem no B2C)

`DATABASE_URL`, `ADMIN_SESSION_SECRET`, `LUNIUM_API_KEY`, `LUNIUM_SETTLEMENT_ADDRESS`, `LUNIUM_WEBHOOK_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `MELHORENVIO_CEP_ORIGEM` e as credenciais do Melhor Envio (`integration_credentials`). Nenhuma variável nova.

## 9. Roteiro de teste manual (depois do preflight e, se preciso, do candidato)

**Preparação (Luis, no Neon, depois de revisar):** ter 1 responsável `active` com login e senha, ao menos 1 `b2b_commercial_groups` visível com produtos ativos que tenham peso e dimensões, e opcionalmente 1 cupom `scope = 'b2b'` e 1 cupom de teste `scope = 'b2b'`, `discount_type = 'percentage'`, `discounts_shipping = true`.

1. **Login:** `/b2b/login` → senha errada dá 401; senha certa leva a `/b2b/painel`.
2. **Painel:** cadastrar um cliente, criar uma oferta com 1+ linhas e clicar em "Gerar link". Gerar de novo e confirmar que **o link anterior para de funcionar** ("Link indisponível").
3. **Oferta** (aba anônima): floral a R$ 19,90; outros produtos a 55% do preço B2C.
4. **Mínimo:** com menos de R$ 250 em produtos, o carrinho mostra "Faltam R$ X" e não libera o checkout.
5. **Frete < R$ 450:** CEP de SP e todas as modalidades com preço real.
6. **Frete ≥ R$ 450:**
   - SP/PR: a mais barata cai para R$ 9,90 (ou para o real, se ele for menor) e as outras ficam cheias.
   - BA/GO: R$ 35,90.
   - CE/AM: R$ 169,90.
7. **CEP × UF:** CEP de SP com UF "RS" → erro "estado não corresponde ao CEP".
8. **Cupom com frete:** um cupom que derruba a base para menos de R$ 450 volta o frete ao preço real. O cupom B2B no checkout **B2C** dá "não encontrado", e um cupom B2C no B2B dá "não é válido para pedidos B2B".
9. **Valores por método:** a lista mostra Pix < cartão < boleto, sem nenhum "%", e a diferença incide só nos produtos (o frete é igual nos três).
10. **Pix** (ambiente de teste/sandbox): gerar o QR e confirmar em `orders` que `payment_method = 'pix'` e que `total_cents` é o valor mostrado. Webhook com `amount_cents` diferente → pedido **continua** `pending` (log "valor divergente").
11. **Trava:** com o `orderId` de um pedido Pix, chamar `POST /api/b2b/payments/boleto` → 409. Sem `b2bToken` → 401. Com o token de outra oferta → 403.
12. **Cartão** (credenciais de teste do Mercado Pago): em pedidos abaixo de R$ 1.000 só aparece 1x; em pedidos de R$ 1.500 ou mais aparecem até 3x. Parcelas acima do permitido via API dão 400.
13. **Boleto:** escolher 2x num total ímpar, conferir `b2b_boleto_requests` (parcela + última = total) e 1 linha em `payments` (`method = 'boleto'`). Repetir a chamada dá `repeated: true`, sem nenhuma linha nova.
14. **Revogação:** revogar o link no painel e confirmar que oferta, cotação e pagamentos com aquele token dão 403.
15. **Regressão B2C:** fazer um pedido B2C com cupom normal e Pix/cartão para confirmar que continua igual.
