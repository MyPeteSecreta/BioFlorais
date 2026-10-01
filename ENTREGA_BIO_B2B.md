# Entrega — Bio Florais B2B (candidata limpa)

- **Pasta:** `C:\Users\User\bio-b2b-limpa` (worktree de `C:\Users\User\BioFlorais`)
- **Branches:** `b2b/bio-limpa-v1` (já em produção, `main` = `10c0f3a`) e **`b2b/bio-admin-v1`** (rodada Admin B2B, local, **sem push**)
- **Base:** `origin/main` = `e043f6a` (merge feito em 30/09; antes era `c15c0c8`)
- **Data:** 30/09/2026

Nada foi feito em `C:\Users\User\BioFlorais`: nenhum arquivo foi alterado ou descartado lá, a main não foi tocada e o Neon não foi acessado. Não houve seed, deploy, push nem pagamento real. As outras marcas também não foram alteradas.

---

## ★★ Segunda publicação: segurança, vencimentos do boleto e abas 2–4 (sobre `bdead29`)

A primeira publicação é o `bdead29` (aba 1). Tudo abaixo vem **depois** dele, na mesma branch `b2b/bio-admin-v1`, só local: sem push, deploy nem acesso ao Neon.

```
7324298 feat(b2b/bio): admin B2B abas 2, 3 e 4 (linhas, promocoes, acompanhamento) + registro de linha aberta fora da oferta
d2f5fc9 feat(b2b/bio): vencimentos do boleto 28/42/56 dias da data do pedido (Sao Paulo), gravados e mostrados no checkout
c2cf328 fix(admin/security): rotas /api/admin/orders/[id]/fulfillment e /shipment exigem a sessao do admin
```

**Verificações (depois de `7324298`):**
- `tsc` exit 0.
- `npm.cmd run build` exit 0 (43/43, com todas as rotas novas).
- `node --test` nos 4 arquivos de `scripts/`: **23/23**.
- `git diff --check` vazio.
- eslint: 0 erros e 0 avisos nos arquivos B2B e admin.

**Ordem sugerida de publicação:**
- `c2cf328` é **só segurança**: não depende de SQL e pode subir sozinho e antes.
- `d2f5fc9` exige o SQL `04b` aplicado antes.
- `7324298` exige o SQL `05b` aplicado antes.

### B.1 Segurança (produção): `c2cf328`

- **Problema:** `PATCH /api/admin/orders/[id]/fulfillment` e `PATCH /api/admin/orders/[id]/shipment` não conferiam a sessão. Qualquer pessoa podia mudar a etapa de separação, a transportadora, o rastreio e marcar como enviado qualquer pedido.
- **Correção:** os dois handlers agora começam com `if (!isAdminRequest(request)) return 401`, usando o mesmo cookie e HMAC do login do admin, com comparação em tempo constante. O `isAdminRequest` passou a aceitar qualquer `Request` (lê o header `cookie`). As telas do admin chamam essas rotas do mesmo domínio, então o cookie segue junto e nada muda para quem está logado.
- **Revisão das demais rotas `/api/admin/*`:** o `login` é público por definição. As rotas `/api/admin/b2b/*` (4 da aba 1 e 7 novas) já exigiam a sessão.
- **Teste** `scripts/admin-session.test.mjs`:
  - aceita o cookie certo e recusa a falta de cookie, cookie errado, truncado ou de outro nome, e a ausência de `ADMIN_SESSION_SECRET`;
  - **varre `src/app/api/admin/**`** e falha se algum handler (exceto o login) não começar com a checagem;
  - confirmei que o teste **falha** com a versão anterior de `fulfillment` e passa com a correção.
- ⚠️ **Achado fora de `/api/admin`, não corrigido (precisa de decisão):** `/api/shipping/melhorenvio/authorize` e `/callback` usam um `state` **fixo** (`"bioflorais-shipping"`) e não exigem sessão. Qualquer pessoa pode iniciar o OAuth com a própria conta do Melhor Envio, e o callback **sobrescreve** as credenciais da loja em `integration_credentials`. A correção sugerida é exigir a sessão do admin nas duas rotas e usar um `state` aleatório guardado em cookie. Não mexi porque mudar o OAuth sem testar pode derrubar a autorização do frete em produção.

### B.2 Vencimentos do boleto B2B: `d2f5fc9`

- Mesma regra e formato da My Pet (`mypeteme-b2b-final…`, commit `d4155e9`): a 1ª parcela vence em **28 dias**, a 2ª em **42** e a 3ª em **56**, contados da **data do pedido** (`orders.created_at`) no calendário de **America/Sao_Paulo**.
- O cronograma é gravado em `b2b_boleto_requests.schedule` como `[{ installment, dueDate: "AAAA-MM-DD", amountCents }]`. Também vai no `rawPayload` do registro em `payments` e volta na resposta da rota.
- A soma das parcelas é **exatamente** o total, com a última absorvendo o arredondamento (mesma divisão já usada nas colunas de parcela).
- **Checkout:**
  - ao escolher as parcelas, mostra a prévia de data e valor de cada uma (base: hoje);
  - depois da solicitação, mostra o cronograma definitivo gravado pelo servidor;
  - o texto da tela explica a regra 28/42/56.
- **Testes:**
  - pedido em 01/10 vence em 29/10, 12/11 e 26/11;
  - pedido às 22:30 de 30/09 em São Paulo (01/10 UTC) conta a partir de 30/09;
  - a virada de ano funciona;
  - parcelas fora de 1 a 3 são recusadas.
- `orders.created_at` é `timestamp` sem fuso e é lido como UTC (padrão do Neon). O preflight `04a` mostra o fuso da sessão do banco para conferir.
- **SQL:** `04a_boleto_schedule_preflight_one_shot.sql` (uma consulta, só leitura) e `04b_boleto_schedule_candidate_if_not_exists.sql` (`ADD COLUMN IF NOT EXISTS schedule jsonb`).
- Solicitações de boleto anteriores ficam sem cronograma; o admin mostra "(sem cronograma gravado)".

### B.3 Abas 2, 3 e 4: `7324298`

**Aba 2: Linhas comerciais**
- Lista com ordem, nome, slug, situação, nº de produtos e nº de ofertas.
- Criar e editar nome, slug (gerado pelo nome se vazio, único), ativa, visível no B2B, ordem e **produtos**, num seletor com filtro **por categoria**, **busca** e "marcar/desmarcar filtrados".
- Não há exclusão: para tirar uma linha de circulação, basta desativá-la ou ocultá-la.

**Aba 3: Promoções**
- Cria e edita só **"compre X, leve Y grátis"**, o **único tipo com efeito real no servidor da Bio** (`promotion-resolver.ts`).
- Campos: vínculo com linhas e/ou produtos (sem vínculo, vale para todos os produtos da oferta), ativa, **selecionável pelo vendedor**, início e fim (datas no calendário de São Paulo, com o fim incluindo o dia todo).
- Promoções de outros tipos já existentes no banco aparecem só para consulta, como "sem efeito na Bio".
- ⚠️ **Percentual e preço fixo não foram criados**, porque não têm efeito no motor de preço da Bio (regra: não criar tipo sem efeito). Implementar exige decidir como interagem com o arredondamento ,90 e com os descontos Pix/cartão.

**Aba 4: Acompanhamento**
- **Ofertas geradas:** vendedor, cliente, linhas, promoções, data e status do link (ativo, revogado, sem link, oferta revogada).
- **Pedidos B2B:** data, pedido (com link para o detalhe no admin), cliente e PF/PJ, vendedor, forma de pagamento, total e status.
- **Solicitações de boleto:** parcelas com **vencimento e valor** de cada uma.
- **Linhas abertas fora da oferta:** cliente, linha, vendedor, quantas vezes e última vez.

**Registro "cliente visualizou a linha X fora da oferta"** (a Bio não registrava; foi criado):
- A página da oferta ganhou a seção **"Outras linhas Bio Florais"**, com as linhas B2B ativas e visíveis que não estão na oferta.
- Ao abrir uma delas, `/b2b/oferta/<token>/linha/<slug>` mostra os produtos **sem preço** e o botão **"Pedir esta linha ao representante"** (WhatsApp para o celular do vendedor, com o texto pronto).
- Ao montar a página, é gravado o evento em `b2b_offer_line_views` (oferta, linha, cliente, vendedor, data). É um POST depois de montar, então prefetch não conta como visita, e há no máximo 1 registro a cada 30 min por oferta e linha.
- **Painel do vendedor:** novo bloco **"Interesses dos clientes"** ("Cliente X visualizou a linha Y (fora da oferta)"), com o botão **"Montar nova oferta"**, que preenche cliente e linha no formulário.

**SQL:** `05a_admin_tabs_preflight_one_shot.sql` (uma consulta, só leitura: slugs duplicados, promoções por tipo e escopo, colunas obrigatórias sem default) e `05b_admin_tabs_candidate_if_not_exists.sql` (`CREATE TABLE IF NOT EXISTS b2b_offer_line_views` + índices).

### B.4 Roteiro de teste da segunda publicação

1. **Segurança:** sem estar logado, `PATCH /api/admin/orders/<id>/fulfillment` e `/shipment` dão 401. Logado no admin, mudar a etapa e o envio de um pedido continua funcionando.
2. **Boleto (PJ):** pedido de R$ 1.500+ em 3x mostra a prévia com 3 datas (hoje + 28/42/56). Depois de confirmar, a tela final mostra o cronograma. Em `b2b_boleto_requests.schedule`, as 3 parcelas somam o total.
3. **Linhas:** criar a linha "Teste B2B" com produtos filtrados por categoria. Ela aparece no painel do vendedor ao montar oferta. Desativá-la faz sumir.
4. **Promoções:** criar "Leve 4 pague 3" (a cada 3, +1) vinculada a uma linha e marcada como selecionável. O vendedor a vê ao montar a oferta, e no checkout, ao comprar 3 unidades, aparece "+1 grátis".
5. **Fora da oferta:** abrir o link de uma oferta que tem só a linha A e clicar em "Outras linhas" → B. A página mostra os produtos sem preço e o botão do WhatsApp. No admin, a aba Acompanhamento lista "cliente / B". No painel do vendedor aparece "Interesses dos clientes", e "Montar nova oferta" já preenche cliente e linha B.
6. **Acompanhamento:** ofertas, pedidos B2B e boletos (com vencimentos) aparecem com os dados certos.

---

## ★ Rodada Admin B2B — entrega da aba 1 (branch `b2b/bio-admin-v1`)

- **Branch nova** `b2b/bio-admin-v1`, criada a partir de `origin/main` = `10c0f3a` (produção). Só local: sem push, deploy, acesso ao Neon ou seed.
- **Commit:** `0701df5 feat(b2b/bio): admin B2B aba 1 (vendedores/RCAs) + convite, cadastro e aprovacao; PF sem boleto; texto de frete especial`
- **Verificações:**
  - `tsc` exit 0.
  - `npm.cmd run build` exit 0 (43/43; gera `/admin/b2b`, `/b2b/convite/[token]`, `/api/admin/b2b/*` e `/api/b2b/invites/accept`).
  - `node --test scripts/b2b-pricing.test.mjs scripts/b2b-invites.test.mjs`: **12/12**.
  - `git diff --check` vazio.
  - eslint: 0 erros nos arquivos novos e alterados; os 3 avisos restantes são das páginas de pedidos, que já existiam.
- **Não testado ponta a ponta contra banco:** sem autorização de acesso ao Neon e sem Postgres local. O roteiro abaixo é para o Luis rodar depois de aplicar o SQL da seção A.3.

### A.1 O que entrou

**Aba 1: Vendedores / RCAs** (`/admin/b2b`, link "B2B" no menu do admin)
- **Lista:** nome, e-mail, tipo (RCA / Vendedor), status (convite pendente, convite expirado, aguardando aprovação, ativo, inativo), data do convite, último acesso, nº de clientes, nº de ofertas e nº de pedidos pagos (`orders.b2b_responsible_id` com status `paid`).
- **Gerar convite** (nome, e-mail, tipo, WhatsApp opcional):
  - Token opaco de 256 bits; o banco guarda só o SHA-256; validade de 7 dias.
  - O link completo `/b2b/convite/<token>` aparece **uma única vez**, com **Copiar** e **Enviar pelo WhatsApp** (`wa.me` com o texto pronto; DDI 55 é colocado automaticamente).
  - Um e-mail que já tem cadastro é recusado, com orientação para usar "Redefinir acesso".
- **Ações:**
  - Nos convites: revogar e gerar novo link (o anterior é revogado).
  - Nos vendedores: aprovar (`company_approved_at` + status `active`), desativar e reativar, redefinir acesso.
  - Quem é reativado sem nunca ter sido aprovado volta para "aguardando aprovação".
  - Redefinir acesso gera um link para definir nova senha, com a mesma mecânica do convite; o link de redefinição anterior é revogado.
- Todas as rotas `/api/admin/b2b/*` **exigem a sessão do admin** que já existe (cookie `mypeteme_admin_session`, comparação em tempo constante).

**Fluxo do vendedor (não existia na Bio)**
1. **Convite** `/b2b/convite/<token>`: o token é validado no servidor e mensagens distintas explicam link inexistente, expirado, substituído ou já usado.
2. **Cadastro:** dados PF (CPF+RG) ou PJ (CNPJ+IE), celular, endereço (CEP preenche o resto), chave Pix e banco para as comissões, **login e senha**, e **termo RCA** (obrigatório para o tipo RCA).
   - A senha é gravada em `scrypt$<salt b64url>$<hash b64url>`, o formato atual da Bio; um teste confirma que hashes do login antigo continuam válidos.
   - O login e o e-mail são únicos, sem diferenciar maiúsculas.
   - O convite é reservado com um UPDATE condicional antes de gravar, então dois envios simultâneos não criam dois cadastros.
3. **Aprovação:** o cadastro nasce com status `pending` e o login responde "cadastro em análise" até o admin aprovar.
4. **Login** `/b2b/login` grava `last_login_at`. Os motivos de bloqueio (em análise / desativado) só aparecem **depois** da senha correta.
5. **Painel** `/b2b/painel` (já existia): criar cliente, criar oferta, gerar o link. A oferta aberta pelo cliente é `/b2b/oferta/<token>`.
   - Ao desativar o vendedor, o acesso dele e os links de oferta dele param na hora, porque a oferta exige responsável ativo.

**Regra nova: PF sem boleto.** No checkout B2B, pessoa física vê só Pix e cartão; se o boleto estava selecionado, volta para Pix. O servidor também recusa: `/api/b2b/orders/create` responde 400 e `/api/b2b/payments/boleto` responde 409 para PF.

**Texto do frete.** Nenhuma tela B2B dizia "frete grátis". O único texto assim é da página de produto **B2C** e não foi tocado. Incluí "Frete especial B2B a partir de R$ 450" na barra do catálogo da oferta e no carrinho B2B.

### A.2 Pontos de atenção

- ⚠️ **Termo RCA provisório:** o texto em `src/app/b2b/convite/[token]/InviteForm.tsx` (`RCA_TERMS`) é um **resumo que eu escrevi**. Precisa ser substituído pelo termo oficial revisado pelo jurídico antes de publicar.
- ~~Segurança: `/api/admin/orders/[id]/fulfillment` e `/shipment` sem sessão~~ → **corrigido em `c2cf328`** (seção B.1).
- **Tipos gravados:** `rca` (RCA) e `clt` (Vendedor), iguais aos da Secreta. O preflight A4 mostra se já existem outros valores no banco.

### A.3 Banco (obrigatório antes do deploy desta branch)

1. `sql/b2b/03a_admin_preflight_one_shot.sql`: um único SELECT, uma linha em json, somente leitura. Mostra colunas novas (ok/FALTANDO), colunas/índices/constraints, tipos e status já gravados, e duplicidade de login ou e-mail sem diferenciar maiúsculas (esperado: vazio).
2. `sql/b2b/03b_admin_candidate_if_not_exists.sql`: numa transação única e só aditivo, cria `b2b_responsibles.last_login_at`, `b2b_responsible_invites.purpose` (default `onboarding`) e `b2b_responsible_invites.responsible_id` (FK `NOT VALID`), mais CHECK e índice. Só mexe em tabelas `b2b_*`; nenhuma rota B2C lê essas tabelas.

### A.4 Roteiro de teste da aba 1 (Luis)

1. Entrar em `/admin/login` e clicar em **B2B** no menu.
2. Clicar em **Gerar convite** (tipo RCA, com WhatsApp): o link aparece com Copiar e WhatsApp, e a lista mostra "Convite pendente". Fechar o aviso e confirmar que o link não aparece de novo.
3. **Gerar novo link** na mesma linha, e abrir o link **antigo**: deve aparecer "substituído ou revogado".
4. Abrir o link novo numa aba anônima e fazer o **cadastro** (login `teste.rca`, senha com 8+ caracteres, aceitar o termo). Deve aparecer "Cadastro enviado". Abrir o mesmo link de novo mostra "já foi usado".
5. Em `/b2b/login` com `teste.rca`: aparece "cadastro em análise". Senha errada dá só "Login ou senha inválidos".
6. No admin, a linha vira **Aguardando aprovação**; clicar em **Aprovar** e ela passa a **Ativo**.
7. Em `/b2b/login`, entra no `/b2b/painel`. No admin, a coluna "Último acesso" fica preenchida.
8. No painel: **cadastrar cliente**, **criar oferta** com 1+ linhas e **gerar link**. No admin, as colunas Clientes e Ofertas passam a 1.
9. Abrir o link da oferta numa aba anônima (como cliente): catálogo com preços B2B e a faixa "Frete especial B2B a partir de R$ 450".
10. No checkout como **pessoa física**, o boleto não aparece. Trocar para **pessoa jurídica** e o boleto aparece.
11. No admin, clicar em **Desativar**: o login do vendedor passa a dizer "acesso desativado" e o link da oferta dele mostra "Link indisponível". Depois **Reativar**.
12. **Redefinir acesso**: abrir o link novo e trocar a senha. A senha antiga para de funcionar e a nova entra.

### A.5 Próxima entrega

Entregue na segunda publicação (seção ★★ acima).

---

## 0. Base

A base `origin/main` = `c15c0c8` foi confirmada como produção pelo Luis. Ainda em 30/09 a produção avançou para **`e043f6a`** ("Pix temporário pelo Mercado Pago enquanto a conta Lunium está bloqueada"), e a branch recebeu `git fetch` + `git merge origin/main` (merge `7f1384d`, **sem conflitos**). Tudo que veio da main foi preservado: `src/app/api/payments/mercadopago/pix/route.ts` e `src/app/checkout/page.tsx` estão **idênticos** a `origin/main` (`git diff origin/main -- <arquivos>` vazio). O commit local `e9954b3`, que só existe na `main` local de `C:\Users\User\BioFlorais`, continua de fora de propósito.

## 1. Commits

```
c09315b feat(b2b/bio): Pix B2B pelo Mercado Pago (NEXT_PUBLIC_PIX_PROVIDER) + cron de conciliacao MP Pix
7f1384d Merge remote-tracking branch 'origin/main' into b2b/bio-limpa-v1   (traz e043f6a)
19a3ffa docs(b2b/bio): ENTREGA com hash e diff --stat da revisao mestre
e40e090 fix(b2b/bio): revisao mestre — arredondamento ,90, checagem de valor Lunium para todos os pedidos, preflight em consulta unica
d3e761c docs(b2b/bio): ENTREGA_BIO_B2B.md (verificacoes, SQLs, roteiro de teste)
e15b51e feat(b2b/bio): telas B2B (oferta, carrinho, checkout, login e painel)
097b29b feat(b2b/bio): regras comerciais, cotacao autoritativa e rotas B2B
d5ae52e feat(b2b/bio): schema B2B (so adicoes) + preflight somente leitura e SQL candidato
```

Um último commit `docs(...)` só atualiza este arquivo.

### Mudanças da revisão da janela mestre

1. **Base:** `c15c0c8` confirmada e mantida.
2. **Webhook e polling Lunium:** a checagem de valor agora vale para **todos** os pedidos, B2C e B2B, igual ao hotfix da Secreta e da My Pet. Só marca pago se `amount_cents == orders.total_cents`; valor ausente também bloqueia.
3. **Arredondamento:** o preço unitário calculado passa a ser a parte inteira em reais + R$ 0,90 (27,00 → 27,90; 27,50 → 27,90; 27,95 → 27,90). É uma função única, `roundB2BUnitPriceCents`, com teste. O floral continua fixo em R$ 19,90, e a regra não se aplica a totais nem aos descontos Pix/cartão.
4. **Preflight em consulta única:** novo `sql/b2b/01b_preflight_one_shot.sql`, um único SELECT que devolve uma linha com uma coluna json (`json_build_object`) com os blocos [1] a [12]. É somente leitura.
5. `tsc` e build rodados de novo: verdes (seção 2).

### Atualização da janela mestre: Pix pelo Mercado Pago (produção `e043f6a`)

1. **Pix B2B segue a mesma chave do B2C.** Enquanto `NEXT_PUBLIC_PIX_PROVIDER` não for `"lunium"`, o checkout B2B chama a nova rota **`/api/b2b/payments/mercadopago/pix`**. Ela exige o token da oferta, a trava `payment_method === "pix"` e o status `"pending"`, e lê o total do banco (`orders.total_cents`, que já tem o desconto Pix de 7%). A rota reaproveita um Pix Mercado Pago ainda válido do mesmo valor (até 25 dos 30 minutos), para não gerar QR duplicado. Com `NEXT_PUBLIC_PIX_PROVIDER=lunium`, volta para `/api/b2b/payments/lunium/pix`.
2. **Confirmação do Pix B2B: o que já cobria e o que precisou mudar.**
   - **Webhook** `/api/webhooks/mercadopago`: **já cobria.** Ele busca o pagamento por `externalId` sem filtrar o método e confirma pela Order API autenticada antes de chamar `finalizeMercadoPagoPaid`.
   - **Rota de status** `/api/orders/[orderId]/status`: **não cobria.** Só conciliava `method === "card"`, então o Pix Mercado Pago (B2C e B2B) ficava só com o webhook. Estendi para `card` **ou** `pix`, priorizando um pagamento já pago e depois o mais recente (o Pix pode ter sido gerado de novo). O polling do checkout B2B (a cada 5s) usa essa rota.
3. **Rede de segurança:** `/api/cron/reconcile-mp-pix` (GET, exige `Authorization: Bearer ${CRON_SECRET}`, comparação em tempo constante; sem `CRON_SECRET` configurado responde sempre 401). Ele busca os `payments` `mercadopago`/`pix` das últimas 48h com pedido `pending` (no máximo 100 por execução), consulta a Order no Mercado Pago, atualiza o status do payment e, se estiver pago, chama `finalizeMercadoPagoPaid` (o mesmo finalizador idempotente do webhook). Vale para B2C e B2B e nunca cria cobrança. O `vercel.json` agenda a rota a cada 10 minutos (`*/10 * * * *`).
   - ⚠️ **Plano Vercel:** crons com frequência maior que diária exigem plano Pro. No Hobby, o deploy com `*/10` é recusado.
   - ⚠️ **`CRON_SECRET`** é variável **nova**: precisa ser criada na Vercel antes do deploy, senão o cron responde 401 e não concilia nada.

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
| Regras puras (`pricing.ts`) | `node --test scripts/b2b-pricing.test.mjs`: **5/5 passam** (arredondamento ,90, floral, 55%, descontos só sobre produtos, mínimo, parcelas, frete regional). Exige Node ≥ 23.6; não usa dependência nova |
| Revisão mestre | `tsc` exit 0 e `npm.cmd run build` exit 0 rodados de novo depois das mudanças (compilou, TypeScript ok, 42/42 páginas) |
| Merge `e043f6a` + Pix B2B Mercado Pago + cron | `tsc` exit 0; `npm.cmd run build` exit 0 (compilou, TypeScript ok, **43/43** páginas, com `/api/b2b/payments/mercadopago/pix`, `/api/cron/reconcile-mp-pix` e `/api/payments/mercadopago/pix` da main); `node --test` 5/5; `git diff --check` vazio; eslint limpo nos arquivos novos |

**Sobre o build:** o build sem variáveis de ambiente falha numa rota B2C que já existia antes desta branch (`/api/admin/orders/[id]/fulfillment`). O motivo é que `src/lib/db/client.ts` lança erro na importação quando `DATABASE_URL` não existe. O build verde acima rodou com `DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build_placeholder`. Esse endereço é fictício e local: o driver HTTP do Neon não conecta no build, e o Neon não foi acessado. Na Vercel a variável real já existe.

### `git diff --stat origin/main..HEAD` (origin/main = e043f6a, até c09315b)

```
 ENTREGA_BIO_B2B.md                                 | 201 ++++++
 scripts/b2b-pricing.test.mjs                       |  61 ++
 sql/b2b/01_preflight_readonly.sql                  | 176 ++++++
 sql/b2b/01b_preflight_one_shot.sql                 | 217 +++++++
 sql/b2b/02_candidate_if_not_exists.sql             | 123 ++++
 src/app/api/b2b/auth/login/route.ts                |  69 ++
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
 src/app/api/b2b/payments/mercadopago/pix/route.ts  | 275 ++++++++
 src/app/api/b2b/promotions/route.ts                |  41 ++
 src/app/api/b2b/shipping/quote/route.ts            |  74 +++
 src/app/api/coupons/validate/route.ts              |   5 +-
 src/app/api/cron/reconcile-mp-pix/route.ts         | 131 ++++
 src/app/api/orders/[orderId]/status/route.ts       |  47 +-
 src/app/api/orders/create/route.ts                 |   6 +-
 src/app/api/webhooks/lunium/route.ts               |  33 +
 src/app/b2b/carrinho/B2BCartContent.tsx            | 106 ++++
 src/app/b2b/carrinho/page.tsx                      |  11 +
 src/app/b2b/checkout/B2BCheckoutContent.tsx        | 691 +++++++++++++++++++++
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
 src/lib/b2b/pricing.ts                             | 294 +++++++++
 src/lib/b2b/promotion-engine.ts                    |  23 +
 src/lib/b2b/promotion-resolver.ts                  | 183 ++++++
 src/lib/b2b/public-offer-context.ts                | 249 ++++++++
 src/lib/b2b/quote.ts                               | 272 ++++++++
 src/lib/b2b/require-responsible.ts                 |  41 ++
 src/lib/b2b/responsible-session.ts                 |  92 +++
 src/lib/b2b/token.ts                               |  14 +
 src/lib/db/schema.ts                               | 351 +++++++++++
 src/lib/shipping/cep-lookup.ts                     |  41 ++
 vercel.json                                        |   8 +
 49 files changed, 6342 insertions(+), 14 deletions(-)
```

## 3. Arquivos B2C tocados (diff mínimo)

| Arquivo | Mudança | Efeito no B2C |
|---|---|---|
| `api/coupons/validate` | filtro `scope = 'b2c'` | cupom B2B deixa de valer no B2C (todo cupom existente fica `b2c` pelo DEFAULT) |
| `api/orders/create` | mesmo filtro no cupom comercial | idem |
| `api/webhooks/lunium` | **qualquer** pedido (B2C e B2B) só vira `paid` se `amount_cents == orders.total_cents`; valor ausente também bloqueia | **muda o B2C de propósito** (revisão mestre, igual ao hotfix da Secreta e da My Pet): um Pix B2C com valor divergente deixa de ser baixado automaticamente e fica no log "valor divergente" |
| `api/orders/[orderId]/status` | mesma regra no polling Lunium, para todos os pedidos; a conciliação Mercado Pago passa a cobrir **Pix** além de cartão | idem; o Pix Mercado Pago do B2C também passa a ser confirmado pelo polling, não só pelo webhook |
| `api/cron/reconcile-mp-pix` (novo) + `vercel.json` (novo) | concilia Pix Mercado Pago pendente das últimas 48h a cada 10 min | rede de segurança para o Pix B2C e B2B |
| `api/payments/mercadopago/pix` e `checkout/page.tsx` | **não tocados** (vieram da main em `e043f6a`) | — |

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
- `sql/b2b/01b_preflight_one_shot.sql` (**preferido**): um único SELECT que devolve **uma linha com uma coluna json** (`preflight`) com os blocos `b1_*` a `b12_*`. Não escreve nada. O bloco [12] usa `to_jsonb(o)->>'b2b_offer_id'` e por isso não falha se a coluna ainda não existir.
- `sql/b2b/01_preflight_readonly.sql`: os mesmos blocos em SELECTs separados, `BEGIN TRANSACTION READ ONLY ... ROLLBACK`. Traz tabelas, colunas (tipo, nulabilidade, default), índices, constraints das tabelas `b2b_*` e de `orders`/`coupons`/`payments`, além de checagens de dados: formato de hash, ofertas sem `activated_at`, produtos sem dimensão, categorias ativas e boletos duplicados.
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
| Demais 55% do B2C | `roundB2BUnitPriceCents(price_cents × 11 / 20)` = parte inteira em reais + R$ 0,90 (regra de todos os sites). Ex.: 59,90 → 32,945 → **32,90**; 50,00 → 27,50 → **27,90**. Só no preço unitário; nunca em totais nem nos descontos Pix/cartão |
| Mínimo R$ 250 | sobre os produtos, antes do cupom; checado na cotação e na criação do pedido |
| Cartão/boleto até 3x, parcela mínima R$ 500 | `resolveB2BAllowedInstallments`, conferido na criação, na rota de cartão e na rota de boleto |
| Pix: provedor | mesma chave do B2C, `NEXT_PUBLIC_PIX_PROVIDER`: diferente de `"lunium"` usa `/api/b2b/payments/mercadopago/pix`; igual a `"lunium"` usa `/api/b2b/payments/lunium/pix`. As duas rotas têm as mesmas travas (token, `payment_method = pix`, `pending`, total do banco) |
| Pix 7% / cartão 3% / boleto cheio, **só sobre produtos** | `resolveB2BOrderTotalCents` = produtos pós-cupom − desconto + frete. O checkout mostra só o valor final de cada método, nunca o %. **Diferença:** a Secreta aplica o % sobre produtos **+ frete**. Alinhar lá se a regra fechada vale para os 3 |
| Frete ≥ R$ 450 (base pós-cupom) | a modalidade mais barata passa a custar `Math.min(tarifa regional, real)` (S/SE R$ 9,90; CO/NE exceto CE R$ 35,90; Norte + CE R$ 169,90); as demais ficam com preço cheio e nenhuma é ocultada; UF conferida pelo CEP (ViaCEP) no servidor; sem conferência, não há tarifa regional |
| Cupom B2B × B2C | `scope`; cupom de parceira nunca vale no B2B |
| Cupom de teste que desconta frete | `discounts_shipping`, **só percentual**: o mesmo % incide sobre o frete cobrado; o custo real (`shipping_cost_cents`) é preservado |
| Servidor recalcula tudo | `src/lib/b2b/quote.ts` é a **única** função usada pela cotação do checkout e pela criação do pedido |
| Token da oferta nos pagamentos | `verifyB2BOrderOfferToken`: a oferta do token precisa ser igual a `orders.b2b_offer_id` |
| Trava por método | `orders.payment_method`; cada rota de pagamento exige igualdade |
| Boleto | idempotente pelo banco (upsert com `xmax = 0`), composição exata `(n−1)·parcela + última = total`, registro em `payments` (`provider = boleto-manual`). **Não emite boleto real** |
| Webhook/polling Lunium | **todo** pedido (B2C e B2B) só vira pago com `amount_cents == total_cents` (valor ausente também bloqueia) |

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

## 8. Variáveis de ambiente

`DATABASE_URL`, `ADMIN_SESSION_SECRET`, `LUNIUM_API_KEY`, `LUNIUM_SETTLEMENT_ADDRESS`, `LUNIUM_WEBHOOK_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `NEXT_PUBLIC_PIX_PROVIDER` (já usada pela main), `MELHORENVIO_CEP_ORIGEM` e as credenciais do Melhor Envio (`integration_credentials`).

**Variável nova:** `CRON_SECRET`, exigida por `/api/cron/reconcile-mp-pix`.

## 9. Roteiro de teste manual (depois do preflight e, se preciso, do candidato)

**Preparação (Luis, no Neon, depois de revisar):** ter 1 responsável `active` com login e senha, ao menos 1 `b2b_commercial_groups` visível com produtos ativos que tenham peso e dimensões, e opcionalmente 1 cupom `scope = 'b2b'` e 1 cupom de teste `scope = 'b2b'`, `discount_type = 'percentage'`, `discounts_shipping = true`.

1. **Login:** `/b2b/login` → senha errada dá 401; senha certa leva a `/b2b/painel`.
2. **Painel:** cadastrar um cliente, criar uma oferta com 1+ linhas e clicar em "Gerar link". Gerar de novo e confirmar que **o link anterior para de funcionar** ("Link indisponível").
3. **Oferta** (aba anônima): floral a R$ 19,90; outros produtos a 55% do preço B2C, **sempre terminando em ,90** (ex.: B2C R$ 59,90 → R$ 32,90).
4. **Mínimo:** com menos de R$ 250 em produtos, o carrinho mostra "Faltam R$ X" e não libera o checkout.
5. **Frete < R$ 450:** CEP de SP e todas as modalidades com preço real.
6. **Frete ≥ R$ 450:**
   - SP/PR: a mais barata cai para R$ 9,90 (ou para o real, se ele for menor) e as outras ficam cheias.
   - BA/GO: R$ 35,90.
   - CE/AM: R$ 169,90.
7. **CEP × UF:** CEP de SP com UF "RS" → erro "estado não corresponde ao CEP".
8. **Cupom com frete:** um cupom que derruba a base para menos de R$ 450 volta o frete ao preço real. O cupom B2B no checkout **B2C** dá "não encontrado", e um cupom B2C no B2B dá "não é válido para pedidos B2B".
9. **Valores por método:** a lista mostra Pix < cartão < boleto, sem nenhum "%", e a diferença incide só nos produtos (o frete é igual nos três).
10. **Pix** (ambiente de teste/sandbox): gerar o QR e confirmar em `orders` que `payment_method = 'pix'` e que `total_cents` é o valor mostrado. Webhook com `amount_cents` diferente → pedido **continua** `pending` (log "valor divergente"). Repetir o teste com um pedido **B2C**: o comportamento tem que ser o mesmo. *(Vale quando `NEXT_PUBLIC_PIX_PROVIDER=lunium`.)*
10b. **Pix Mercado Pago** (padrão enquanto a Lunium estiver bloqueada): o checkout B2B mostra o QR do Mercado Pago com o valor Pix (7% de desconto nos produtos). Em `payments` aparece a linha `provider = mercadopago`, `method = pix`, com `externalId` = id da Order. Recarregar ou tentar de novo em até 25 min **reaproveita** o mesmo QR. Ao pagar, a tela confirma sozinha (polling) e o pedido vira `paid` / `paid_to_prepare`. Chamar a rota com o `orderId` de um pedido boleto dá 409; sem token dá 401.
10c. **Cron:** `GET /api/cron/reconcile-mp-pix` sem header ou com secret errado dá 401. Com `Authorization: Bearer <CRON_SECRET>` devolve `{ ok, candidates, checked, ordersPaid }`. Um Pix pago cujo webhook não chegou é baixado na próxima execução.
11. **Trava:** com o `orderId` de um pedido Pix, chamar `POST /api/b2b/payments/boleto` → 409. Sem `b2bToken` → 401. Com o token de outra oferta → 403.
12. **Cartão** (credenciais de teste do Mercado Pago): em pedidos abaixo de R$ 1.000 só aparece 1x; em pedidos de R$ 1.500 ou mais aparecem até 3x. Parcelas acima do permitido via API dão 400.
13. **Boleto:** escolher 2x num total ímpar, conferir `b2b_boleto_requests` (parcela + última = total) e 1 linha em `payments` (`method = 'boleto'`). Repetir a chamada dá `repeated: true`, sem nenhuma linha nova.
14. **Revogação:** revogar o link no painel e confirmar que oferta, cotação e pagamentos com aquele token dão 403.
15. **Regressão B2C:** fazer um pedido B2C com cupom normal e Pix/cartão para confirmar que continua igual.
